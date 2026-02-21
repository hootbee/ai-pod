import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateEpisodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  script: string;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  audioPath?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sourceCount?: number;
}
