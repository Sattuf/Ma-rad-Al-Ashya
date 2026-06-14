import { TransactionStatus } from '../entities/transaction.entity';

export enum TransactionAction {
  CONFIRM = 'confirm',
  CANCEL = 'cancel',
}

export enum ActorRole {
  SELLER = 'seller',
  BUYER = 'buyer',
}

export function getNextStatus(
  currentStatus: TransactionStatus,
  action: TransactionAction,
  actorRole: ActorRole
): { nextStatus?: TransactionStatus; error?: string } {
  if (action === TransactionAction.CANCEL) {
    if (currentStatus === TransactionStatus.COMPLETED || currentStatus === TransactionStatus.CANCELLED) {
      return { error: 'Cannot cancel a completed or already cancelled transaction' };
    }
    return { nextStatus: TransactionStatus.CANCELLED };
  }

  if (action === TransactionAction.CONFIRM) {
    if (currentStatus === TransactionStatus.PENDING_SELLER) {
      if (actorRole !== ActorRole.SELLER) {
        return { error: 'Only seller can confirm at this stage' };
      }
      return { nextStatus: TransactionStatus.PENDING_BUYER };
    }

    if (currentStatus === TransactionStatus.PENDING_BUYER) {
      if (actorRole !== ActorRole.BUYER) {
        return { error: 'Only buyer can confirm at this stage' };
      }
      return { nextStatus: TransactionStatus.COMPLETED };
    }

    return { error: 'Cannot confirm transaction in current status' };
  }

  return { error: 'Invalid action' };
}
