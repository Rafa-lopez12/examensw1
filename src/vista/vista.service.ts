import { Injectable } from '@nestjs/common';
import { CreateVistaDto } from './dto/create-vista.dto';
import { UpdateVistaDto } from './dto/update-vista.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vista } from './entities/vista.entity';
import { Figura } from '../figura/entities/figura.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';

@Injectable()
export class VistaService {

  @InjectRepository(Vista)
  private readonly vistaRepository: Repository<Vista>

  @InjectRepository(Proyecto)
  private readonly proyectoRepository: Repository<Proyecto>

  async create(createVistaDto: CreateVistaDto) {
    
    const {proyectoId, ...vistaData}= createVistaDto

    const proyecto = await this.proyectoRepository.findOne({ where: { id: proyectoId } });
      if (!proyecto) {
        throw new Error('El proyecto especificado no existe');
      }
  
    const vista=this.vistaRepository.create({
      ...vistaData,
      proyecto
    })
    
    const vist=await this.vistaRepository.save(vista)
    return vist;
  }

  async findAll(id: string) {
    
    const proyecto = await this.proyectoRepository.findOne({ where: { id: id } });
    if (!proyecto) {
      throw new Error('El proyecto especificado no existe');
    }

    const vistas= this.vistaRepository.find({ where:{ proyecto: {id}}})
    return vistas
    
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
