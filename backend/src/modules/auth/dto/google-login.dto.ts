import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idToken?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accessToken?: string;
}
