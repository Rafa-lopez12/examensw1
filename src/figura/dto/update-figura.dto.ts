import { PartialType } from '@nestjs/mapped-types';
import { CreateFiguraDto } from './create-figura.dto';

export class UpdateFiguraDto extends PartialType(CreateFiguraDto) {}
