import { ApiProperty } from '@nestjs/swagger';

export class BatchProfileRequestDto {
  @ApiProperty({ description: 'Array of user UUIDs to fetch', required: false })
  user_uuids?: string[];

  @ApiProperty({ description: 'Array of business UUIDs to fetch', required: false })
  business_uuids?: string[];
}

export class UserProfileDto {
  @ApiProperty({ description: 'User UUID' })
  uuid: string;

  @ApiProperty({ description: 'User display name' })
  name: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  avatar_url?: string;
}

export class BusinessProfileDto {
  @ApiProperty({ description: 'Business UUID' })
  uuid: string;

  @ApiProperty({ description: 'Business name' })
  name: string;

  @ApiProperty({ description: 'Business avatar/logo URL', required: false })
  avatar_url?: string;
}

export class BatchProfileResponseDto {
  @ApiProperty({
    description: 'Array of user profiles',
    type: [UserProfileDto],
  })
  users: UserProfileDto[];

  @ApiProperty({
    description: 'Array of business profiles',
    type: [BusinessProfileDto],
  })
  businesses: BusinessProfileDto[];
}