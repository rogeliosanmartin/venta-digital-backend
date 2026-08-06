import { IsString, Matches, Length } from 'class-validator';

export class RequestSellerPinDto {
  @IsString()
  @Length(10, 10, { message: 'El celular debe tener 10 dígitos' })
  @Matches(/^\d{10}$/, { message: 'El celular solo debe contener números' })
  cellphone: string;
}
