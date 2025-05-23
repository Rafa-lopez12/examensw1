// src/openai/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Component, Service, Module, ProcessedResponse, AppModule } from './openai.interfaces';

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
  }): Promise<ProcessedResponse> {
    try {
      this.logger.log('Generando código Angular a partir de captura de pantalla...');
      
      // 1. Preparar la imagen en formato base64
      const imageBase64 = this.prepareImageBase64(data.image);
      this.logger.log(`Tamaño de la imagen en base64: ${imageBase64.length} caracteres`);
      
      // 2. Llamar a la API de OpenAI con el formato correcto
      this.logger.log(`Enviando solicitud a OpenAI para generación de código de página "${data.pageName}"`);
      const response = await this.callOpenAI(imageBase64, data.pageName, data.description);
      
      // 3. Procesar la respuesta
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('La respuesta de OpenAI no contiene contenido.');
      }
      
      this.logger.log(`Longitud del contenido de respuesta: ${content.length} caracteres`);
      this.logger.log(`Primeros 100 caracteres: ${content.substring(0, 100)}...`);
      
      // 4. Extraer y procesar el código
      const processedResult = this.processCode(content);
      this.logger.log(`Resultado procesado: ${JSON.stringify({
        componentes: processedResult.components.length,
        servicios: processedResult.services.length,
        modulos: processedResult.modules.length
      })}`);
      
      return processedResult;
    } catch (error) {
      this.logger.error(`Error al generar código Angular: ${error.message}`);
      
      // Si el error viene de OpenAI, obtener más detalles
      if (error.response) {
        this.logger.error(`Error de la API OpenAI: ${JSON.stringify({
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })}`);
      }
      
      throw new Error(`Error al generar código Angular: ${error.message}`);
    }
  }

  /**
   * Prepara la imagen en formato base64
   */
  private prepareImageBase64(image: Buffer | string): string {
    if (Buffer.isBuffer(image)) {
      return image.toString('base64');
    } else if (typeof image === 'string') {
      if (image.startsWith('data:image')) {
        return image.split(',')[1];
      }
      return image;
    }
    throw new Error('Formato de imagen no soportado');
  }

  /**
   * Realiza la llamada a la API de OpenAI
   */
  private async callOpenAI(imageBase64: string, pageName: string, description?: string) {
    return await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un experto desarrollador en Angular que puede analizar diseños visuales y generar código preciso. Tu tarea es generar código completo para implementar la interfaz mostrada en la imagen.
  
  INSTRUCCIONES IMPORTANTES:
  1. Genera todo el código necesario (componentes, servicios, módulos) de forma completa y funcional.
  2. ASEGÚRATE DE INCLUIR EL CÓDIGO HTML COMPLETO para cada componente. El HTML debe reflejar exactamente la interfaz que se muestra en la imagen.
  3. Para cada TIPO de archivo, usa el formato adecuado con un comentario claro:
  
  PARA COMPONENTES TYPESCRIPT:
  \`\`\`typescript
  // NOMBRE_DEL_COMPONENTE.component.ts
  [código aquí]
  \`\`\`
  
  PARA PLANTILLAS HTML (OBLIGATORIO):
  \`\`\`html
  // NOMBRE_DEL_COMPONENTE.component.html
  [código HTML completo aquí]
  \`\`\`
  
  PARA ESTILOS CSS (OBLIGATORIO):
  \`\`\`css
  // NOMBRE_DEL_COMPONENTE.component.css
  [código CSS aquí]
  \`\`\`
  
  PARA SERVICIOS:
  \`\`\`typescript
  // NOMBRE_DEL_SERVICIO.service.ts
  [código aquí]
  \`\`\`
  
  PARA MÓDULOS:
  \`\`\`typescript
  // NOMBRE_DEL_MÓDULO.module.ts
  [código aquí]
  \`\`\`
  
  PARA APP MODULE (OBLIGATORIO):
  \`\`\`typescript
  // app.module.ts
  [código aquí]
  \`\`\`
  
  3. Asegúrate de que cada tipo de archivo esté claramente separado y etiquetado.
  4. Organiza la respuesta por secciones (Componentes, Servicios, Módulos, AppModule).
  5. NO OMITAS EL CÓDIGO HTML bajo ninguna circunstancia.
  6. IMPORTANTE: Genera todos los estilos en CSS, NO en SCSS. Usa CSS puro en los archivos .css.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Por favor, genera el código Angular completo para implementar la interfaz de usuario que se muestra en la imagen. Esta es una página llamada "${pageName}"${description ? ` que ${description}` : ''}.
  
  Analiza cuidadosamente la imagen y genera el código Angular necesario para implementar esta interfaz de manera funcional.
  
  Por favor incluye:
  1. Estructura de componentes (archivos .ts, .html y .css para cada componente)
  2. Servicios necesarios (.service.ts)
  3. Módulo Angular (.module.ts) para cada característica
  4. Archivo app.module.ts principal que importe todos los componentes
  
  Recuerda: Usa CSS en lugar de SCSS para todos los estilos.`
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
      max_tokens: 8192,
      temperature: 0.2,
    });
  }

  /**
   * Procesa el código obtenido de la API
   */
  private processCode(responseText: string): ProcessedResponse {
    try {
      this.logger.log("Procesando el código...");
      
      // Colecciones para almacenar los resultados
      const components: Component[] = [];
      const services: Service[] = [];
      const modules: Module[] = [];
      
      // Almacenar bloques de código por nombre de archivo
      const codeBlocks = new Map<string, string>();
      const processedFiles = new Map<string, boolean>();
      
      // 1. Extraer todos los bloques de código con sus nombres de archivo
      this.extractFileBlocks(responseText, codeBlocks);
      this.logger.log(`Bloques de código extraídos: ${codeBlocks.size}`);
      
      // 2. Procesar cada bloque de código según su tipo
      const processedResult = this.processCodeBlocks(codeBlocks, processedFiles, components, services, modules);
      
      // 3. Si no se encontró código, intentar con un método más flexible
      if (components.length === 0 && services.length === 0 && modules.length === 0 && !processedResult.appModule) {
        this.logger.warn('No se encontraron archivos con el formato esperado. Intentando método alternativo...');
        return this.extractWithExtendedPatterns(responseText);
      }
      
      // 4. Si no tenemos un AppModule, generarlo
      if (!processedResult.appModule) {
        processedResult.appModule = this.generateAppModule({ 
          components, 
          services, 
          modules 
        });
        this.logger.log('AppModule generado automáticamente');
      }
      
      return processedResult;
    } catch (error) {
      this.logger.error(`Error al procesar el código: ${error.message}`);
      // Intentar con método alternativo en caso de error
      return this.extractWithExtendedPatterns(responseText);
    }
  }

  /**
   * Extrae bloques de código y sus nombres de archivo
   */
  private extractFileBlocks(text: string, blocks: Map<string, string>): void {
    // Patrones para diferentes tipos de archivos
    const patterns = [
      // AppModule específicamente
      /```(?:typescript|ts)[\s\n]*\/\/[\s\n]*app\.module\.ts[\s\S]*?```/g,
      
      // TypeScript (.ts) - componentes, servicios, módulos
      /```(?:typescript|ts)[\s\n]*\/\/[\s\n]*([\w-]+\.(?:component|service|module)\.ts)[\s\S]*?```/g,
      
      // HTML (.html)
      /```html[\s\n]*\/\/[\s\n]*([\w-]+\.component\.html)[\s\S]*?```/g,
      
      // CSS (.css) - modificado para buscar .css en lugar de .scss
      /```css[\s\n]*\/\/[\s\n]*([\w-]+\.component\.css)[\s\S]*?```/g
    ];
    
    // Comprobar primero si hay un app.module.ts explícito
    const appModuleMatch = text.match(/```(?:typescript|ts)[\s\n]*\/\/[\s\n]*app\.module\.ts[\s\S]*?```/);
    if (appModuleMatch) {
      const appModuleCode = this.extractCodeContent(appModuleMatch[0]);
      blocks.set('app.module.ts', appModuleCode);
      this.logger.log(`Bloque encontrado: app.module.ts (${appModuleCode.length} caracteres)`);
    }
    
    // Procesar los demás patrones
    for (let i = appModuleMatch ? 1 : 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        if (match[0]) {
          // El patrón del AppModule es especial y no tiene grupo de captura
          if (i === 0 && appModuleMatch) {
            continue; // Ya procesamos el AppModule arriba
          }
          
          // Para los demás patrones, usar el grupo de captura para el nombre del archivo
          const fileName = match[1]?.trim();
          if (!fileName) continue;
          
          // Evitar procesar app.module.ts dos veces
          if (fileName === 'app.module.ts' && blocks.has('app.module.ts')) {
            continue;
          }
          
          const codeBlock = match[0];
          const codeContent = this.extractCodeContent(codeBlock);
          
          blocks.set(fileName, codeContent);
          this.logger.log(`Bloque encontrado: ${fileName} (${codeContent.length} caracteres)`);
        }
      }
    }
    
    // Si no se encontraron bloques HTML pero sí componentes TypeScript,
    // intentar buscar bloques HTML sin el formato de comentario esperado
    if (Array.from(blocks.keys()).some(k => k.endsWith('.component.ts')) && 
        !Array.from(blocks.keys()).some(k => k.endsWith('.component.html'))) {
      
      this.logger.warn('No se encontraron bloques HTML con el formato esperado. Buscando bloques HTML genéricos...');
      
      // Buscar bloques HTML sin el formato de comentario esperado
      const htmlBlocks = Array.from(text.matchAll(/```html[\s\S]*?```/g));
      const tsFiles = Array.from(blocks.keys()).filter(k => k.endsWith('.component.ts'));
      
      for (let i = 0; i < htmlBlocks.length && i < tsFiles.length; i++) {
        const tsFileName = tsFiles[i];
        const componentName = tsFileName.replace('.component.ts', '');
        const htmlFileName = `${componentName}.component.html`;
        
        // Extraer el contenido del HTML
        const htmlContent = this.extractCodeContent(htmlBlocks[i][0]);
        
        // Guardar el HTML asociándolo con el componente
        blocks.set(htmlFileName, htmlContent);
        this.logger.log(`Asociado HTML genérico con componente: ${htmlFileName}`);
      }
    }
    
    // Similar para CSS, buscar bloques CSS genéricos si necesario
    if (Array.from(blocks.keys()).some(k => k.endsWith('.component.ts')) && 
        !Array.from(blocks.keys()).some(k => k.endsWith('.component.css'))) {
      
      this.logger.warn('No se encontraron bloques CSS con el formato esperado. Buscando bloques CSS genéricos...');
      
      // Buscar bloques CSS sin el formato de comentario esperado
      const cssBlocks = Array.from(text.matchAll(/```css[\s\S]*?```/g));
      const tsFiles = Array.from(blocks.keys()).filter(k => k.endsWith('.component.ts'));
      
      for (let i = 0; i < cssBlocks.length && i < tsFiles.length; i++) {
        const tsFileName = tsFiles[i];
        const componentName = tsFileName.replace('.component.ts', '');
        const cssFileName = `${componentName}.component.css`;
        
        // Extraer el contenido del CSS
        const cssContent = this.extractCodeContent(cssBlocks[i][0]);
        
        // Guardar el CSS asociándolo con el componente
        blocks.set(cssFileName, cssContent);
        this.logger.log(`Asociado CSS genérico con componente: ${cssFileName}`);
      }
    }
  }
  

  /**
   * Procesa los bloques de código extraídos
   */
  private processCodeBlocks(
    codeBlocks: Map<string, string>,
    processedFiles: Map<string, boolean>,
    components: Component[],
    services: Service[],
    modules: Module[]
  ): { components: Component[], services: Service[], modules: Module[], appModule?: AppModule } {
    let appModule: AppModule | undefined = undefined;
    
    // Primero verificar si existe un app.module.ts
    if (codeBlocks.has('app.module.ts')) {
      const appModuleCode = codeBlocks.get('app.module.ts');
      if (appModuleCode) {
        appModule = { code: appModuleCode };
        processedFiles.set('app.module.ts', true);
        this.logger.log('AppModule procesado desde el código generado');
      }
    }
    
    // Procesar el resto de archivos
    for (const [fileName, codeContent] of codeBlocks.entries()) {
      // Evitar procesar el mismo archivo más de una vez
      if (processedFiles.has(fileName)) {
        continue;
      }
      
      // Evitar procesar app.module.ts como un módulo normal
      if (fileName === 'app.module.ts') {
        continue; // Ya lo procesamos arriba
      }
      
      if (fileName.endsWith('.component.ts')) {
        // Es un archivo TypeScript de componente
        const componentName = fileName.replace('.component.ts', '');
        
        // Buscar su HTML y CSS correspondiente (cambiado de scss a css)
        const htmlFileName = `${componentName}.component.html`;
        const cssFileName = `${componentName}.component.css`; // Cambiado de .scss a .css
        
        const htmlContent = codeBlocks.get(htmlFileName) || '';
        const cssContent = codeBlocks.get(cssFileName) || '';
        
        this.logger.log(`Componente ${componentName} - HTML: ${htmlContent.length} caracteres, CSS: ${cssContent.length} caracteres`);
        
        // Crear el componente
        components.push({
          name: componentName,
          typescript: codeContent,
          html: htmlContent,
          css: cssContent
        });
        
        // Marcar estos archivos como procesados
        processedFiles.set(fileName, true);
        processedFiles.set(htmlFileName, true);
        processedFiles.set(cssFileName, true);
        
        this.logger.log(`Componente procesado: ${componentName}`);
      }
      else if (fileName.endsWith('.service.ts') && !processedFiles.has(fileName)) {
        // Es un archivo de servicio
        const serviceName = fileName.replace('.service.ts', '');
        
        services.push({
          name: serviceName,
          code: codeContent
        });
        
        processedFiles.set(fileName, true);
        this.logger.log(`Servicio procesado: ${serviceName}`);
      }
      else if (fileName.endsWith('.module.ts') && !processedFiles.has(fileName) && fileName !== 'app.module.ts') {
        // Es un archivo de módulo (que no sea AppModule)
        const moduleName = fileName.replace('.module.ts', '');
        
        modules.push({
          name: moduleName,
          code: codeContent
        });
        
        processedFiles.set(fileName, true);
        this.logger.log(`Módulo procesado: ${moduleName}`);
      }
    }
    
    return { components, services, modules, appModule };
  }

  /**
   * Método alternativo para extraer código si el primer método falla
   */
  private extractWithExtendedPatterns(responseText: string): ProcessedResponse {
    this.logger.log('Usando método alternativo de extracción...');
    
    const components: Component[] = [];
    const services: Service[] = [];
    const modules: Module[] = [];
    let appModule: AppModule | undefined = undefined;
    
    // 1. Intentar extraer el AppModule directamente
    const appModuleMatch = responseText.match(/```(?:typescript|ts)[\s\S]*?@NgModule[\s\S]*?export\s+class\s+AppModule[\s\S]*?```/);
    if (appModuleMatch) {
      appModule = { code: this.extractCodeContent(appModuleMatch[0]) };
      this.logger.log('AppModule extraído con método alternativo');
    }
    
    // 2. Extraer componentes
    this.extractComponents(responseText, components);
    
    // 3. Extraer servicios
    this.extractServices(responseText, services, components);
    
    // 4. Extraer módulos (excluyendo AppModule)
    this.extractModules(responseText, modules, components, services);
    
    // 5. Si aún no encontramos nada, crear componente de error
    if (components.length === 0 && services.length === 0 && modules.length === 0) {
      this.createErrorComponent(components, responseText);
    }
    
    // 6. Si no tenemos un AppModule, generarlo
    if (!appModule) {
      appModule = this.generateAppModule({ components, services, modules });
      this.logger.log('AppModule generado automáticamente');
    }
    
    return { components, services, modules, appModule };
  }

  /**
   * Extrae componentes del texto de respuesta
   */
  private extractComponents(text: string, components: Component[]): void {
    // Encontrar bloques de componentes TypeScript por decorador @Component
    const componentBlocks = this.findAllMatches(text, /@Component[\s\S]*?export\s+class\s+(\w+)/g);
    
    for (const [blockText, className] of componentBlocks) {
      // Extraer nombre del componente a partir del nombre de la clase
      const componentName = className.replace(/Component$/, '').toLowerCase();
      
      const typescript = this.extractRelevantCode(blockText, 'typescript');
      
      // Buscar HTML y CSS asociados por proximidad o nombre
      let html = '';
      let css = '';
      
      // Buscar el bloque HTML más cercano después del componente
      const htmlMatch = text.substring(text.indexOf(blockText) + blockText.length)
        .match(/```html[\s\S]*?```/);
      
      if (htmlMatch) {
        html = this.extractCodeContent(htmlMatch[0]);
      }
      
      // Buscar el bloque CSS/SCSS más cercano
      const cssMatch = text.substring(
        text.indexOf(blockText) + blockText.length + (htmlMatch ? htmlMatch[0].length : 0)
      ).match(/```(?:scss|css)[\s\S]*?```/);
      
      if (cssMatch) {
        css = this.extractCodeContent(cssMatch[0]);
      }
      
      components.push({
        name: componentName,
        typescript,
        html,
        css
      });
    }
  }

  /**
   * Extrae servicios del texto de respuesta
   */
  private extractServices(text: string, services: Service[], components: Component[]): void {
    // Encontrar servicios por decorador @Injectable
    const serviceBlocks = this.findAllMatches(text, /@Injectable[\s\S]*?export\s+class\s+(\w+)/g);
    
    for (const [blockText, className] of serviceBlocks) {
      // Extraer nombre del servicio
      const serviceName = className.replace(/Service$/, '').toLowerCase();
      
      const code = this.extractRelevantCode(blockText, 'typescript');
      
      // Verificar que no sea un duplicado de un componente
      if (!components.some(c => c.typescript.includes(className))) {
        services.push({
          name: serviceName,
          code
        });
      }
    }
  }

  /**
   * Extrae módulos del texto de respuesta
   */
  private extractModules(text: string, modules: Module[], components: Component[], services: Service[]): void {
    // Encontrar módulos por decorador @NgModule
    const moduleBlocks = this.findAllMatches(text, /@NgModule[\s\S]*?export\s+class\s+(\w+)Module/g);
    
    for (const [blockText, className] of moduleBlocks) {
      // Saltarse AppModule, que se maneja por separado
      if (className.toLowerCase() === 'app') {
        continue;
      }
      
      // Extraer nombre del módulo
      const moduleName = className.toLowerCase();
      
      const code = this.extractRelevantCode(blockText, 'typescript');
      
      // Verificar que no sea un duplicado
      if (!components.some(c => c.typescript.includes(className + 'Module')) && 
          !services.some(s => s.code.includes(className + 'Module')) &&
          !modules.some(m => m.name === moduleName)) {
        modules.push({
          name: moduleName,
          code
        });
      }
    }
  }

  /**
   * Crea un componente de error
   */
  private createErrorComponent(components: Component[], responseText: string): void {
    this.logger.warn('No se pudo extraer ningún código válido de la respuesta.');
    
    components.push({
      name: 'error-component',
      typescript: `
        import { Component } from '@angular/core';
        
        @Component({
          selector: 'app-error',
          templateUrl: './error-component.html',
          styleUrls: ['./error-component.css']
        })
        export class ErrorComponent {
          constructor() { }
        }
      `,
      html: `
        <div class="error-container">
          <h2>Error al generar código</h2>
          <p>No se pudo procesar la respuesta de la IA. Por favor intenta con otra captura o contacta al soporte.</p>
          <pre>${responseText.substring(0, 500)}...</pre>
        </div>
      `,
      css: `
        .error-container {
          padding: 20px;
          border: 1px solid #f44336;
          border-radius: 4px;
          background-color: #ffebee;
          color: #d32f2f;
        }
        pre {
          white-space: pre-wrap;
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          font-size: 12px;
        }
      `
    });
  }

  /**
   * Encuentra todas las coincidencias de un patrón con captura de grupos
   */
  private findAllMatches(text: string, pattern: RegExp): Array<[string, string]> {
    const results: Array<[string, string]> = [];
    const matches = text.matchAll(pattern);
    
    for (const match of matches) {
      if (match[0] && match[1]) {
        results.push([match[0], match[1]]);
      }
    }
    
    return results;
  }

  /**
   * Extrae código relevante buscando el bloque markdown completo
   */
  private extractRelevantCode(text: string, language: string): string {
    // Buscar el bloque de código más cercano
    const blockMatch = text.match(new RegExp(`\`\`\`(?:${language})?[\\s\\S]*?\`\`\``));
    
    if (blockMatch) {
      return this.extractCodeContent(blockMatch[0]);
    }
    
    // Si no se encuentra un bloque, intentar extraer el código directamente
    const codeStart = text.indexOf('import ');
    if (codeStart >= 0) {
      return text.substring(codeStart);
    }
    
    return text;
  }

 
  private extractCodeContent(codeBlock: string): string {
    return codeBlock
      .replace(/```(typescript|ts|html|css)[\s\n]*\/\/[\s\n]*.*[\s\n]*/g, '') 
      .replace(/```(typescript|ts|html|css)[\s\n]*/g, '') 
      .replace(/```$/g, '')
      .trim();
  }



  private generateAppModule(processedResult: ProcessedResponse): AppModule {
    const { components, services, modules } = processedResult;
    
    // Lista de componentes
    const componentsList = components.map(c => `${this.pascalCase(c.name)}Component`).join(',\n    ');
    
    // Lista de servicios
    const servicesList = services.map(s => `${this.pascalCase(s.name)}Service`).join(',\n    ');
    
    // Lista de módulos
    const modulesList = modules.map(m => `${this.pascalCase(m.name)}Module`).join(',\n    ');
    
    // Importaciones
    let imports = '';
    
    // Importar componentes
    components.forEach(c => {
      imports += `import { ${this.pascalCase(c.name)}Component } from './components/${c.name}/${c.name}.component';\n`;
    });
    
    // Importar servicios
    services.forEach(s => {
      imports += `import { ${this.pascalCase(s.name)}Service } from './services/${s.name}.service';\n`;
    });
    
    // Importar módulos
    modules.forEach(m => {
      imports += `import { ${this.pascalCase(m.name)}Module } from './modules/${m.name}.module';\n`;
    });
    
    // Construir el código del AppModule
    const code = `import { BrowserModule } from '@angular/platform-browser';
  import { NgModule } from '@angular/core';
  import { FormsModule, ReactiveFormsModule } from '@angular/forms';
  import { HttpClientModule } from '@angular/common/http';
  import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
  
  import { AppComponent } from './app.component';
  ${imports}
  
  @NgModule({
    declarations: [
      AppComponent,
      ${componentsList}
    ],
    imports: [
      BrowserModule,
      FormsModule,
      ReactiveFormsModule,
      HttpClientModule,
      BrowserAnimationsModule,
      ${modulesList}
    ],
    providers: [
      ${servicesList}
    ],
    bootstrap: [AppComponent]
  })
  export class AppModule { }`;
  
    return { code };
  }
  
  /**
   * Convierte una cadena en formato camelCase a PascalCase
   */
  private pascalCase(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }
}