import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Message } from './message.entity';
import { Participant } from './participant.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ 
    type: 'varchar', 
    unique: true,
    comment: 'User ID from kaha-main-v3 service' 
  })
  kahaId: string;

  // Relationships
  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];

  @OneToMany(() => Participant, (participant) => participant.user)
  participations: Participant[];
}