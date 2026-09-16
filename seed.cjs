const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.jchrtqgzvidlcezzhols:aa9ncxPHTKWrtpvG@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
client.connect().then(async () => {
  const razas = [
    { nombre: 'Brahman', diasGestacion: 290 },
    { nombre: 'Gyr', diasGestacion: 290 },
    { nombre: 'Holstein', diasGestacion: 280 },
    { nombre: 'Jersey', diasGestacion: 280 },
    { nombre: 'Angus', diasGestacion: 283 },
    { nombre: 'Otra', diasGestacion: 285 }
  ];
  for (const r of razas) {
    await client.query('INSERT INTO catalogo_raza (nombre, dias_gestacion) VALUES ($1, $2)', [r.nombre, r.diasGestacion]);
  }
  console.log('Razas insertadas correctamente');
  await client.end();
}).catch(console.error);
