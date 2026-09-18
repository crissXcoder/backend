import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedRazas1789700000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO catalogo_raza (nombre, dias_gestacion)
            VALUES 
                ('Holstein', 281),
                ('Jersey', 279),
                ('Pardo Suizo', 290),
                ('Brahman', 293),
                ('Nelore', 293),
                ('Girolando', 290)
            ON CONFLICT (nombre) DO UPDATE 
            SET dias_gestacion = EXCLUDED.dias_gestacion;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // En una migración de seed, el down() podría borrar o revertir. 
        // Para evitar borrar datos del usuario que hayan referenciado estas razas,
        // simplemente no hacemos un DROP destructivo por nombre, o lo hacemos si no hay referencias.
        // Lo más seguro es hacer un delete suave o no hacer nada si las razas están en uso.
        await queryRunner.query(`
            DELETE FROM catalogo_raza 
            WHERE nombre IN ('Holstein', 'Jersey', 'Pardo Suizo', 'Brahman', 'Nelore', 'Girolando')
            AND NOT EXISTS (
                SELECT 1 FROM animal WHERE raza_id = catalogo_raza.id
            );
        `);
    }
}
