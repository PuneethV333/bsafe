import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must include country code, e.g. +919876543210' })
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  relationship?: string | null;
}