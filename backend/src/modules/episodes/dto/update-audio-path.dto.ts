import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateAudioPathDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  audioPath: string;
}
