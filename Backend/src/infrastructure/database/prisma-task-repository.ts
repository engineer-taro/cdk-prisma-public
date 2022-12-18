import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { TaskRepository } from "../../domain/repository/task-repository";

export class PrismaTaskRepository implements TaskRepository {
  constructor(private prismaClient: PrismaClient) {}
  async insert(text: string) {
    const id = uuidv4();
    await this.prismaClient.task.create({
      data: {
        id: id,
        text: text,
      },
    });
    return id;
  }
}
