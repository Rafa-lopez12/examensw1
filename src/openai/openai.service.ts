// src/openai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Component, Service, Module } from './openai.interfaces';


@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger('OpenAIService');

  constructor(
    private configService: ConfigService
  ) {
    // Inicializar el cliente OpenAI con la API key desde las variables de entorno
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Genera código Angular a partir de una captura de pantalla
   */
  async generateAngularCodeFromScreenshot(data: {
    image: Buffer | string, // Imagen en formato base64 o Buffer
    pageName: string,
    description?: string
  }): Promise<any> {
    try {
      this.logger.log('Generando código Angular a partir de captura de pantalla...');
      
      // Convertir imagen a base64 si es necesario
      const imageBase64 = Buffer.isBuffer(data.image) 
        ? data.image.toString('base64') 
        : data.image;
      
      // Llamar a la API de OpenAI con la imagen
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Modelo con capacidad de visión
        messages: [
          {
            role: 'system',
            content: 'Eres un experto desarrollador en Angular que puede analizar diseños visuales y generar código preciso. Genera código completo, bien estructurado y funcional.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Por favor, genera el código Angular completo para implementar la interfaz de usuario que se muestra en la imagen. Esta es una página llamada "${data.pageName}"${data.description ? ` que ${data.description}` : ''}.

                Analiza cuidadosamente la imagen y genera el código Angular (componentes, servicios, etc.) necesario para implementar esta interfaz de manera funcional.

                Por favor incluye:
                1. Estructura de componentes
                2. Archivos HTML
                3. Archivos CSS/SCSS
                4. TypeScript con lógica básica
                5. Servicios necesarios
                6. Módulo Angular

                Usa Angular 16+ y las mejores prácticas de desarrollo.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      });

      // Procesar la respuesta para extraer componentes
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('La respuesta de OpenAI no contiene contenido.');
      }
      return this.processResponse(content);
    } catch (error) {
      this.logger.error(`Error al generar código Angular: ${error.message}`);
      throw new Error(`Error al generar código Angular: ${error.message}`);
    }
  }

  /**
   * Procesa la respuesta de OpenAI para extraer los componentes Angular
   */
  private processResponse(responseText: string): any {
    try {
      // Estructuras para almacenar los diferentes archivos de código
      const components: Component[] = [];
      const services: Service[] = [];
      const modules: Module[] = [];
      
      // Expresiones regulares para identificar bloques de código
      const tsComponentRegex = /```(typescript|ts)[\s\S]*?\/\/\s*([\w-]+\.component\.ts)[\s\S]*?```/g;
      const htmlRegex = /```html[\s\S]*?\/\/\s*([\w-]+\.component\.html)[\s\S]*?```/g;
      const cssRegex = /```(scss|css)[\s\S]*?\/\/\s*([\w-]+\.component\.(scss|css))[\s\S]*?```/g;
      const serviceRegex = /```(typescript|ts)[\s\S]*?\/\/\s*([\w-]+\.service\.ts)[\s\S]*?```/g;
      const moduleRegex = /```(typescript|ts)[\s\S]*?\/\/\s*([\w-]+\.module\.ts)[\s\S]*?```/g;
      
      // Extraer componentes TypeScript
      let match;
      while ((match = tsComponentRegex.exec(responseText)) !== null) {
        const filename = match[2];
        const code = this.extractCodeContent(match[0]);
        const componentName = filename.replace('.component.ts', '');
        
        // Inicializar el objeto del componente
        if (!components.find(c => c.name === componentName)) {
          components.push({
            name: componentName,
            typescript: code,
            html: '',
            css: ''
          });
        } else {
          // Actualizar código TypeScript si ya existe el componente
          const component = components.find(c => c.name === componentName);
          if (component) { // Verifica explícitamente que component no sea undefined
            component.typescript = code;
          }
        }
      }
      
      // Extraer HTML
      while ((match = htmlRegex.exec(responseText)) !== null) {
        const filename = match[1];
        const code = this.extractCodeContent(match[0]);
        const componentName = filename.replace('.component.html', '');
        
        // Actualizar el HTML del componente
        const component = components.find(c => c.name === componentName);
        if (component) {
          component.html = code;
        }
      }
      
      // Extraer CSS/SCSS
      while ((match = cssRegex.exec(responseText)) !== null) {
        const filename = match[2];
        const code = this.extractCodeContent(match[0]);
        const componentName = filename.replace(/\.component\.(scss|css)/, '');
        
        // Actualizar el CSS del componente
        const component = components.find(c => c.name === componentName);
        if (component) {
          component.css = code;
        }
      }
      
      // Extraer servicios
      while ((match = serviceRegex.exec(responseText)) !== null) {
        const filename = match[2];
        const code = this.extractCodeContent(match[0]);
        services.push({
          name: filename.replace('.service.ts', ''),
          code: code
        });
      }
      
      // Extraer módulos
      while ((match = moduleRegex.exec(responseText)) !== null) {
        const filename = match[2];
        const code = this.extractCodeContent(match[0]);
        modules.push({
          name: filename.replace('.module.ts', ''),
          code: code
        });
      }
      
      return {
        components,
        services,
        modules
      };
    } catch (error) {
      this.logger.error(`Error al procesar la respuesta: ${error.message}`);
      throw new Error(`Error al procesar la respuesta de OpenAI: ${error.message}`);
    }
  }

  /**
   * Extrae el contenido de código de un bloque markdown
   */
  private extractCodeContent(codeBlock: string): string {
    return codeBlock
      .replace(/```(typescript|ts|html|scss|css)[\s\n]*\/\/[\s\n]*.*[\s\n]*/g, '')
      .replace(/```$/g, '')
      .trim();
  }
}
