import { IsNumber, IsString, Length, Matches } from 'class-validator';

export class VerifySellerPinDto {
  @IsNumber()
  nipId: number;

  @IsString()
  @Length(4, 8)
  nip: string;

  @IsString()
  @Length(10, 10)
  @Matches(/^\d{10}$/)
  cellphone: string;
}
