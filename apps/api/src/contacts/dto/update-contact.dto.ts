import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  relationship?: string | null;
}