import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  ssl:
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL?.includes('supabase')
      ? { rejectUnauthorized: false }
      : false,
  synchronize: false, // REGLA OBLIGATORIA: Nunca synchronize: true en ningún ambiente
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
