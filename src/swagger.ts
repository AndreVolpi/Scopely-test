import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Scopely Test',
      version: '0.0.1',
      description: 'Auto-generated API docs using swagger-jsdoc',
    },
  },
  apis: ['./src/controllers/**/*.ts'], // Adjust path to your route files
};

export default swaggerJsdoc(swaggerOptions);

