import { logger } from '../core/logger-utility.js';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../database/db.js';

export class ReceiptProcessingService {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async processReceipt(userId, filePath) {
    const client = await this.pool.connect();
    try {
      const extractionId = uuidv4();
      await client.query(
        `INSERT INTO document_extractions (
          extraction_id, user_id, file_path, status
        ) VALUES ($1, $2, $3, $4)`,
        [extractionId, userId, filePath, 'PENDING']
      );

      logger.info(`Started processing receipt for user ${userId}`);
      return {
        extractionId,
        status: 'PENDING'
      };
    } catch (error) {
      logger.error('Error processing receipt:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
