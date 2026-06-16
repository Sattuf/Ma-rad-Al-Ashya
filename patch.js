const fs = require('fs');
const path = require('path');

const services = [
  'api-gateway',
  'auth-service',
  'listings-service',
  'search-service',
  'messaging-service',
  'transactions-service',
  'identity-service',
  'users-service',
  'moderation-service'
];

const basePath = path.join(__dirname, 'services');

const sentryFilterContent = `import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
    }
  }
}
`;

function processService(service) {
  const servicePath = path.join(basePath, service);
  
  // 1. package.json
  const pkgPath = path.join(servicePath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies['@willsoto/nestjs-prometheus'] = '^6.0.0';
    pkg.dependencies['@sentry/node'] = '^8.0.0';
    pkg.dependencies['prom-client'] = '^15.0.0';
    
    if (service === 'api-gateway') {
      pkg.dependencies['@nestjs/throttler'] = '^6.0.0'; // using v6
      pkg.dependencies['cache-manager'] = '^5.0.0';
      pkg.dependencies['@nestjs/cache-manager'] = '^2.0.0';
      pkg.dependencies['cache-manager-redis-yet'] = '^5.0.0';
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }

  // 2. .env.example
  const envPath = path.join(servicePath, '.env.example');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('SENTRY_DSN')) {
      envContent += '\nSENTRY_DSN=https://example@sentry.io/1234567\n';
      fs.writeFileSync(envPath, envContent);
    }
  } else {
    fs.writeFileSync(envPath, 'SENTRY_DSN=https://example@sentry.io/1234567\n');
  }

  // 3. src/filters/sentry-exception.filter.ts
  const filtersDir = path.join(servicePath, 'src', 'filters');
  if (!fs.existsSync(filtersDir)) {
    fs.mkdirSync(filtersDir, { recursive: true });
  }
  fs.writeFileSync(path.join(filtersDir, 'sentry-exception.filter.ts'), sentryFilterContent);

  // 4. main.ts
  const mainPath = path.join(servicePath, 'src', 'main.ts');
  if (fs.existsSync(mainPath)) {
    let mainContent = fs.readFileSync(mainPath, 'utf8');
    if (!mainContent.includes('@sentry/node')) {
      const importSentry = "import * as Sentry from '@sentry/node';\nimport { SentryExceptionFilter } from './filters/sentry-exception.filter';\n";
      
      // insert imports at top
      mainContent = importSentry + mainContent;
      
      // insert Sentry init and filter
      const initSentry = `
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
  app.useGlobalFilters(new SentryExceptionFilter());
`;
      // find const app = await NestFactory.create(...)
      const appCreateRegex = /(const app\s*=\s*await NestFactory\.create\(.*?\);)/;
      mainContent = mainContent.replace(appCreateRegex, `$1\n${initSentry}`);
      fs.writeFileSync(mainPath, mainContent);
    }
  }

  // 5. app.module.ts
  const appModulePath = path.join(servicePath, 'src', 'app.module.ts');
  if (fs.existsSync(appModulePath)) {
    let appContent = fs.readFileSync(appModulePath, 'utf8');
    if (!appContent.includes('PrometheusModule')) {
      const importProm = "import { PrometheusModule } from '@willsoto/nestjs-prometheus';\n";
      appContent = importProm + appContent;
      
      // insert into imports array
      const importsRegex = /imports:\s*\[([\s\S]*?)\]/m;
      appContent = appContent.replace(importsRegex, `imports: [\n    PrometheusModule.register(),$1]`);
      fs.writeFileSync(appModulePath, appContent);
    }
  }
}

services.forEach(processService);
console.log('Processed all 9 services for Sentry & Prometheus.');
