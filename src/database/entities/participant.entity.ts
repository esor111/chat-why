import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

export enum ParticipantRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  BUSINESS = 'business',
  MEMBER = 'member',
  ADMIN = 'admin',
}

@Entity('participants')
export class Participant {
  @PrimaryColumn({ type: 'uuid' })
  conversationId: string;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER,
    comment: 'Role of participant in conversation',
  })
  role: ParticipantRole;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId: string;

  @Column({ type: 'boolean', default: false })
  isMuted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.participations)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'lastReadMessageId' })
  lastReadMessage: Message;
}