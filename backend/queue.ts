import { Env } from './index';

export interface BackgroundJob {
  id: number;
  job_type: 'create_customer_folders' | 'move_country_folders' | 'archive_customer_folders';
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error_message: string | null;
}

export async function enqueueJob(env: Env, jobType: string, payload: any): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  await env.DB.prepare(
    `INSERT INTO background_jobs (job_type, payload) VALUES (?, ?)`
  )
    .bind(jobType, payloadStr)
    .run();
}

export async function processQueue(env: Env): Promise<void> {
  // Fetch pending jobs
  const pendingJobs = await env.DB.prepare(
    `SELECT * FROM background_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 5`
  ).all<BackgroundJob>();

  if (!pendingJobs.results || pendingJobs.results.length === 0) {
    return;
  }

  for (const job of pendingJobs.results) {
    // Mark as processing
    await env.DB.prepare(
      `UPDATE background_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(job.id)
      .run();

    try {
      // Execute job logic based on job_type
      const payload = JSON.parse(job.payload);

      if (job.job_type === 'create_customer_folders') {
        await processCreateCustomerFolders(env, payload);
      } else if (job.job_type === 'move_country_folders') {
        await processMoveCountryFolders(env, payload);
      } else if (job.job_type === 'archive_customer_folders') {
        await processArchiveCustomerFolders(env, payload);
      } else {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Mark as completed
      await env.DB.prepare(
        `UPDATE background_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
        .bind(job.id)
        .run();

    } catch (error: any) {
      console.error(`Job ${job.id} failed:`, error);
      
      const newAttempts = job.attempts + 1;
      const newStatus = newAttempts >= 3 ? 'failed' : 'pending'; // retry 3 times max

      // Mark as failed or pending retry
      await env.DB.prepare(
        `UPDATE background_jobs SET status = ?, attempts = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
        .bind(newStatus, newAttempts, error.message || 'Unknown error', job.id)
        .run();
    }
  }
}

// Dummy implementations for now - these will interact with Google Drive API in the future
async function processCreateCustomerFolders(env: Env, payload: any): Promise<void> {
  console.log(`[Queue] Processing create_customer_folders for payload:`, payload);
  // e.g., payload = { customer_id: 123 }
  // 1. Get customer
  // 2. Call Drive API to create folder CUST-123 under the country/representative
  // 3. Update customers table with drive_folder_id
  
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function processMoveCountryFolders(env: Env, payload: any): Promise<void> {
  console.log(`[Queue] Processing move_country_folders for payload:`, payload);
  // e.g., payload = { country_code: 'TR', new_representative_id: 2 }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function processArchiveCustomerFolders(env: Env, payload: any): Promise<void> {
  console.log(`[Queue] Processing archive_customer_folders for payload:`, payload);
  // e.g., payload = { customer_id: 123 }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}
