import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: [{ type: String }], required: true })
  participants: string[];

  @Prop({ type: String })
  listingId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  unreadCounts: Record<string, number>;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ type: [{ type: String }], default: [] })
  blockedBy: string[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
// Inbox query: { participants: userId } sorted by updatedAt
ConversationSchema.index({ participants: 1, updatedAt: -1 });
