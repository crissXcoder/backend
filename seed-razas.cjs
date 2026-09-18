const { Client } = require('pg');

async function seed() {
  const client = new Client({ connectionString: 'postgresql://postgres.jchrtqgzvidlcezzhols:aa9ncxPHTKWrtpvG@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
  await client.connect();
  
  try {
    // Check if tenant exists, we need a tenant_id for the razas
    const tenantRes = await client.query('SELECT id FROM tenant LIMIT 1');
    if (tenantRes.rows.length === 0) {
      console.log('No tenants found. Creating a default tenant...');
      await client.query(`INSERT INTO tenant (id, nombre, rnc, estatus) VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', '000000000', 'Activo') ON CONFLICT DO NOTHING`);
    }
    
    const tenantId = (await client.query('SELECT id FROM tenant LIMIT 1')).rows[0].id;
    console.log('Using tenant_id:', tenantId);

    const razas = [
      { nombre: 'Holstein', diasGestacion: 281 },
      { nombre: 'Jersey', diasGestacion: 279 },
      { nombre: 'Pardo Suizo', diasGestacion: 290 },
      { nombre: 'Brahman', diasGestacion: 293 },
      { nombre: 'Nelore', diasGestacion: 293 },
      { nombre: 'Girolando', diasGestacion: 290 }
    ];
    
    for (const r of razas) {
      await client.query(
        'INSERT INTO catalogo_raza (tenant_id, nombre, dias_gestacion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', 
        [tenantId, r.nombre, r.diasGestacion]
      );
    }
    console.log('Razas insertadas correctamente');
  } catch (error) {
    console.error('Error seeding razas:', error);
  } finally {
    await client.end();
  }
}

seed();
