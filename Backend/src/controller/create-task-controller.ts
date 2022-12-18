import { PrismaTaskRepository } from "../infrastructure/database/prisma-task-repository";
import { getPrismaClient } from "../infrastructure/database/client";

export class CreateTaskController {
  async execute() {
    try {
      const taskRepository = new PrismaTaskRepository(await getPrismaClient());
      const id = await taskRepository.insert(`TaskText: ${Date.now()}`);
      console.log(id);
    } catch (e: any) {
      console.log(e);
    }
  }
}
