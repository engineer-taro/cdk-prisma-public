import { CreateTaskController } from "./create-task-controller";

describe("テスト(実行のみ)", () => {
  test("insert", async () => {
    const controller = new CreateTaskController();
    await controller.execute();
  });
});
