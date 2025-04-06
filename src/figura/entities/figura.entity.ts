import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Vista } from '../../vista/entities/vista.entity';

@Entity('figura')
export class Figura {
    @PrimaryGeneratedColumn('uuid')
    id:string

    @ManyToOne(
        () => Vista,
         ( vista ) => vista.figura,
         { eager: true }
    )
    vista:Vista

    @Column()
    tipo: string

    @Column()
    x: number

    @Column()
    y:number

    @Column()
    width: number

    @Column()
    height: number

    @Column()
    color:number

}
