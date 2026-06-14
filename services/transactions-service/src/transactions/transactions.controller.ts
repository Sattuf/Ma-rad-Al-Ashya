import { Controller, Post, Get, Body, Param, Req, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, CancelTransactionDto } from './dto/transaction.dto';
import { Request } from 'express';

// Simple mock for JWT payload since auth logic varies. Assuming JWT sets user in req.user
function getUserId(req: Request): string {
  const user = req['user'];
  if (user && user.sub) return user.sub;
  if (user && user.userId) return user.userId;
  // Fallback for testing without actual auth guard if none provided in this specific microservice scope.
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString());
      return payload.sub || payload.userId;
    } catch(e) {}
  }
  throw new UnauthorizedException();
}

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller()
export class TransactionsController {
  constructor(private readonly txService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  async create(@Req() req: Request, @Body() dto: CreateTransactionDto) {
    const userId = getUserId(req);
    return this.txService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions for user' })
  async findAll(
    @Req() req: Request,
    @Query('role') role: string = 'all',
    @Query('status') status: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const userId = getUserId(req);
    return this.txService.findAll(userId, role, status, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction details' })
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = getUserId(req);
    return this.txService.findOne(id, userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm transaction' })
  async confirm(@Req() req: Request, @Param('id') id: string) {
    const userId = getUserId(req);
    return this.txService.confirm(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel transaction' })
  async cancel(@Req() req: Request, @Param('id') id: string, @Body() dto: CancelTransactionDto) {
    const userId = getUserId(req);
    return this.txService.cancel(id, userId, dto);
  }
}
