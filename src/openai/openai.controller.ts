// src/openai/openai.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  UploadedFile, 
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OpenAIService } from './openai.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities/auth.entity';
import { 
  CodeGenerationResult, 
  ScreenshotGenerationParams 
} from './openai.interfaces';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('code-generator')
export class OpenAIController {
  private readonly logger = new Logger('OpenAIController');

  constructor(private readonly openaiService: OpenAIService) {}

  @Post('generate-from-screenshot')
  @Auth()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/screenshots',
        filename: (req, file, cb) => {
          // Genera un nombre único para el archivo
          const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
          const ext = extname(file.originalname);
          cb(null, `screenshot-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Acepta solo imágenes
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
          return cb(
            new HttpException(
              'Solo se permiten archivos de imagen',
              HttpStatus.BAD_REQUEST
            ),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB tamaño máximo
      },
    })
  )
  async generateCodeFromScreenshot(
    @UploadedFile() image,
    @Body('pageName') pageName: string,
    @Body('description') description: string,
    @GetUser() user: User
  ): Promise<CodeGenerationResult> {
    try {
      if (!image) {
        throw new HttpException(
          'No se proporcionó ninguna imagen',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!pageName || pageName.trim() === '') {
        throw new HttpException(
          'El nombre de la página es obligatorio',
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(`Usuario ${user.id} solicitó generación de código para la página "${pageName}"`);

      // Generar el código Angular a partir de la captura de pantalla
      const generatedCode = await this.openaiService.generateAngularCodeFromScreenshot({
        image: image.buffer,
        pageName,
        description
      });
      
      return {
        success: true,
        message: 'Código generado exitosamente a partir de captura de pantalla',
        data: generatedCode,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error al generar código: ${error.message}`);
      
      return {
        success: false,
        message: `Error al generar código desde captura: ${error.message}`,
        error: error.message
      };
    }
  }
}
