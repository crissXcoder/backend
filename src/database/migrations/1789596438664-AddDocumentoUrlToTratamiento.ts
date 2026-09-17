import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentoUrlToTratamiento1789596438664 implements MigrationInterface {
    name = 'AddDocumentoUrlToTratamiento1789596438664'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tratamiento_sanitario" ADD "documento_url" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tratamiento_sanitario" DROP COLUMN "documento_url"`);
    }

}
