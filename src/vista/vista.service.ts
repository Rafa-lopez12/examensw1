import { Injectable } from '@nestjs/common';
import { CreateVistaDto } from './dto/create-vista.dto';
import { UpdateVistaDto } from './dto/update-vista.dto';

@Injectable()
export class VistaService {
  create(createVistaDto: CreateVistaDto) {
    return 'This action adds a new vista';
  }

  findAll() {
    return `This action returns all vista`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vista`;
  }

  update(id: number, updateVistaDto: UpdateVistaDto) {
    return `This action updates a #${id} vista`;
  }

  remove(id: number) {
    return `This action removes a #${id} vista`;
  }
}
