import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres.jchrtqgzvidlcezzhols:aa9ncxPHTKWrtpvG@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });

async function run() {
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [
      JSON.stringify({ tenant_id: '270d197a-ce3f-4372-8c33-3ea62600e5fa', sub: 'c2ddf521-f85a-4752-a9cd-803e4354cac8' })
    ]);
    await client.query('SET LOCAL ROLE authenticated;');
    
    // Create Evento
    const eventoId = 'f76d91d8-0000-0000-0000-000000000000';
    await client.query(`
      INSERT INTO evento (id, tenant_id, animal_id, tipo, fecha_evento, usuario_id, revertido)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      eventoId, 
      '270d197a-ce3f-4372-8c33-3ea62600e5fa',
      '855adaaa-d2da-499e-854d-24bd63e1aa58',
      'SERVICIO',
      '2026-09-17',
      'c2ddf521-f85a-4752-a9cd-803e4354cac8',
      false
    ]);
    
    // Create EventoServicio
    await client.query(`
      INSERT INTO evento_servicio (evento_id, tipo_servicio, toro_o_pajilla, responsable, palpacion_fecha, secado_fecha, aviso_parto_fecha, aviso_parto_urgente_fecha, fpp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      eventoId,
      'Inseminación Artificial',
      'TITAN',
      '',
      '2026-10-27',
      '2027-04-20',
      '2027-06-04',
      '2027-06-16',
      '2027-06-19'
    ]);
    
    console.log("SUCCESS!");
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
run();
