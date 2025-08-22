import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Message } from "./message.entity";
import { Participant } from "./participant.entity";

export enum ConversationType {
  DIRECT = "direct",
  GROUP = "group",
  BUSINESS = "business",
}

@Entity("conversations")
export class Conversation extends BaseEntity {
  @Column({
    type: "enum",
    enum: ConversationType,
    comment: "Type of conversation: direct, group, or business",
  })
  type: ConversationType;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  lastActivity: Date;

  @Column({ type: "uuid", nullable: true })
  lastMessageId: string;

  @Column({ type: "uuid", nullable: true })
  businessId?: string;

  @Column({ type: "varchar", nullable: true })
  name?: string;

  // Relationships
  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => Participant, (participant) => participant.conversation)
  participants: Participant[];

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: "lastMessageId" })
  lastMessage: Message;
}
