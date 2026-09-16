import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jchrtqgzvidlcezzhols.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjaHJ0cWd6dmlkbGNlenpob2xzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODczMDczMywiZXhwIjoyMDk0MzA2NzMzfQ.vHIi6Nk8X1oFIxxJ4MjuwEFVUgAyRfI42pRvKy3dn5U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error fetching buckets:', error);
    return;
  }
  console.log('Buckets:', data.map(b => b.name));
  
  if (!data.some(b => b.name === 'animal_docs')) {
    console.log('Creating animal_docs bucket...');
    const { data: newBucket, error: createError } = await supabase.storage.createBucket('animal_docs', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      fileSizeLimit: 10485760 // 10 MB
    });
    if (createError) {
      console.error('Error creating bucket:', createError);
    } else {
      console.log('Bucket created successfully:', newBucket);
    }
  } else {
    console.log('animal_docs bucket already exists.');
    // Let's ensure it's public
    await supabase.storage.updateBucket('animal_docs', { public: true });
  }
}

checkBuckets();
