import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnimalPurchaseFields1789538300367 implements MigrationInterface {
    name = 'AddAnimalPurchaseFields1789538300367'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE "animal" ADD "origen" text`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "comprado_a" text`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "fecha_compra" date`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "valor_compra_crc" numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "numero_guia" text`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "metodo_compra" text`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "metodos_combinados" text array`);
        await queryRunner.query(`ALTER TABLE "animal" ADD "referencia_pago" text`);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {

    }

}
