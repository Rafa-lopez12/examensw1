// src/openai/interfaces/openai.interfaces.ts

/**
 * Interfaz para los componentes Angular generados
 */
export interface Component {
    name: string;
    typescript: string;
    html: string;
    css: string;
  }
  
  /**
   * Interfaz para los servicios Angular generados
   */
  export interface Service {
    name: string;
    code: string;
  }
  
  /**
   * Interfaz para los módulos Angular generados
   */
  export interface Module {
    name: string;
    code: string;
  }
  
  /**
   * Interfaz para la respuesta completa procesada
   */
  export interface ProcessedResponse {
    components: Component[];
    services: Service[];
    modules: Module[];
  }
  
  /**
   * Interfaz para los parámetros de generación de código desde captura
   */
  export interface ScreenshotGenerationParams {
    image: Buffer | string;
    pageName: string;
    description?: string;
  }
  
  /**
   * Interfaz para el resultado de generación de código
   */
  export interface CodeGenerationResult {
    success: boolean;
    message: string;
    data?: ProcessedResponse;
    error?: string;
    generatedAt?: string;
  }
  
  /**
   * Interfaz para los mensajes de estado de la generación
   */
  export interface CodeGenerationStatus {
    status: 'started' | 'processing' | 'completed' | 'error' | 'cancelled';
    message: string;
  }