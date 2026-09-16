import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.jchrtqgzvidlcezzhols:aa9ncxPHTKWrtpvG@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function fixRLS() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Policy for INSERT
    await client.query(`
      CREATE POLICY "Allow public uploads animal_docs"
      ON storage.objects FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'animal_docs');
    `).catch(e => console.log('Policy insert may already exist:', e.message));

    // Policy for SELECT
    await client.query(`
      CREATE POLICY "Allow public read animal_docs"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'animal_docs');
    `).catch(e => console.log('Policy select may already exist:', e.message));

    // Policy for UPDATE
    await client.query(`
      CREATE POLICY "Allow public update animal_docs"
      ON storage.objects FOR UPDATE
      TO public
      USING (bucket_id = 'animal_docs');
    `).catch(e => console.log('Policy update may already exist:', e.message));

    // Policy for DELETE
    await client.query(`
      CREATE POLICY "Allow public delete animal_docs"
      ON storage.objects FOR DELETE
      TO public
      USING (bucket_id = 'animal_docs');
    `).catch(e => console.log('Policy delete may already exist:', e.message));

    console.log('Policies created successfully');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixRLS();
