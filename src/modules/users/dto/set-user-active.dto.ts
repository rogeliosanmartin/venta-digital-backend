import { IsBoolean } from 'class-validator';

export class SetUserActiveDto {
  @IsBoolean({ message: 'active debe ser true o false' })
  active: boolean;
}
