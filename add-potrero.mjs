import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.jchrtqgzvidlcezzhols:aa9ncxPHTKWrtpvG@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    await client.query(`
      ALTER TABLE animal ADD COLUMN potrero text;
    `);

    console.log('Column potrero added successfully');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column already exists!');
    } else {
      console.error('Error:', err);
    }
  } finally {
    await client.end();
  }
}

run();
