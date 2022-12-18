import { CreateTaskController } from "../controller/create-task-controller";
export async function handler() {
  const controller = new CreateTaskController();
  await controller.execute();
}
