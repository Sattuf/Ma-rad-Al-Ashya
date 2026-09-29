import { Column, Entity, PrimaryColumn } from 'typeorm';

export const MAX_MESSAGE_LENGTH = 2000;

/** Table shape for db/migrations/0003 (checked by scripts/check-entity-schema.ts). */
@Entity('messages')
export class MessageEntity {
  /** BIGINT identity: monotonic, so history pages by keyset on (conversation_id, id). */
  @PrimaryColumn('bigint')
  id: string;

  /** Leading column of the primary key (see db/migrations/0003 for why). */
  @PrimaryColumn('uuid', { name: 'conversation_id' })
  conversationId: string;

  @Column('uuid', { name: 'sender_id' })
  senderId: string;

  @Column('varchar', { length: MAX_MESSAGE_LENGTH })
  content: string;

  @Column('text', { name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;
}
