import { Injectable } from '@nestjs/common';
import { CreateFiguraDto } from './dto/create-figura.dto';
import { UpdateFiguraDto } from './dto/update-figura.dto';

@Injectable()
export class FiguraService {
  create(createFiguraDto: CreateFiguraDto) {
    return 'This action adds a new figura';
  }

  findAll() {
    return `This action returns all figura`;
  }

  findOne(id: number) {
    return `This action returns a #${id} figura`;
  }

  update(id: number, updateFiguraDto: UpdateFiguraDto) {
    return `This action updates a #${id} figura`;
  }

  remove(id: number) {
    return `This action removes a #${id} figura`;
  }
}
