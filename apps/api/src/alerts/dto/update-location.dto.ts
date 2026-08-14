import { IsLatitude, IsLongitude, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLocationDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
