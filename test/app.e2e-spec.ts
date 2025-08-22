import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { DataSource } from "typeorm";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";

describe("Chat Backend Integration Tests", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let authToken: string;
  let testUserId: string;
  let testKahaId: string;
  let otherUserId: string;
  let otherUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Setup test user
    testUserId = uuidv4();
    testKahaId = `test-kaha-${Date.now()}`;

    // Create JWT token for authentication
    authToken = jwtService.sign({
      sub: testUserId,
      kahaId: testKahaId,
      iat: Math.floor(Date.now() / 1000),
    });

    // Setup second test user
    otherUserId = uuidv4();
    const otherKahaId = `test-kaha-other-${Date.now()}`;

    otherUserToken = jwtService.sign({
      sub: otherUserId,
      kahaId: otherKahaId,
      iat: Math.floor(Date.now() / 1000),
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (dataSource) {
      await dataSource.query("DELETE FROM messages WHERE 1=1");
      await dataSource.query("DELETE FROM participants WHERE 1=1");
      await dataSource.query("DELETE FROM conversations WHERE 1=1");
      await dataSource.query("DELETE FROM users WHERE 1=1");
    }

    await app.close();
  });

  describe("Health Check", () => {
    it("should return app status", () => {
      return request(app.getHttpServer())
        .get("/")
        .expect(200)
        .expect("Hello World!");
    });
  });

  describe("Authentication Flow", () => {
    it("should reject requests without authentication", () => {
      return request(app.getHttpServer()).get("/conversations").expect(401);
    });

    it("should accept requests with valid JWT token", () => {
      return request(app.getHttpServer())
        .get("/conversations")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);
    });

    it("should auto-create user from JWT token", async () => {
      await request(app.getHttpServer())
        .get("/conversations")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify user was created in database
      const user = await dataSource.query("SELECT * FROM users WHERE id = $1", [
        testUserId,
      ]);

      expect(user).toHaveLength(1);
      expect(user[0].kaha_id).toBe(testKahaId);
    });
  });

  describe("Direct Conversation Flow", () => {
    let conversationId: string;

    beforeAll(async () => {
      // Auto-create the other user by making a request
      await request(app.getHttpServer())
        .get("/conversations")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .expect(200);
    });

    it("should create a direct conversation", async () => {
      const response = await request(app.getHttpServer())
        .post("/conversations/direct")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          participantId: otherUserId,
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.type).toBe("direct");
      expect(response.body.participants).toHaveLength(2);

      conversationId = response.body.id;
    });

    it("should send a message in direct conversation", async () => {
      const messageContent = "Hello from integration test!";

      const response = await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: messageContent,
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.content).toBe(messageContent);
      expect(response.body.senderId).toBe(testUserId);
      expect(response.body.conversationId).toBe(conversationId);
    });

    it("should retrieve messages from conversation", async () => {
      const response = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].content).toBe(
        "Hello from integration test!"
      );
      expect(response.body.data[0].senderId).toBe(testUserId);
    });

    it("should allow other participant to read messages", async () => {
      const response = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].content).toBe(
        "Hello from integration test!"
      );
    });
  });

  describe("Group Conversation Flow", () => {
    let groupConversationId: string;
    let thirdUserId: string;
    let thirdUserToken: string;

    beforeAll(async () => {
      // Create third test user for group conversation
      thirdUserId = uuidv4();
      const thirdKahaId = `test-kaha-third-${Date.now()}`;

      thirdUserToken = jwtService.sign({
        sub: thirdUserId,
        kahaId: thirdKahaId,
        iat: Math.floor(Date.now() / 1000),
      });

      // Auto-create the third user
      await request(app.getHttpServer())
        .get("/conversations")
        .set("Authorization", `Bearer ${thirdUserToken}`)
        .expect(200);
    });

    it("should create a group conversation", async () => {
      const response = await request(app.getHttpServer())
        .post("/conversations/group")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Group Chat",
          participantIds: [testUserId, thirdUserId],
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.type).toBe("group");
      expect(response.body.name).toBe("Test Group Chat");
      expect(response.body.participants).toHaveLength(2);

      groupConversationId = response.body.id;
    });

    it("should send messages in group conversation", async () => {
      const messageContent = "Hello group!";

      const response = await request(app.getHttpServer())
        .post(`/conversations/${groupConversationId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: messageContent,
        })
        .expect(201);

      expect(response.body.content).toBe(messageContent);
      expect(response.body.senderId).toBe(testUserId);
    });

    it("should allow all group members to read messages", async () => {
      const response = await request(app.getHttpServer())
        .get(`/conversations/${groupConversationId}/messages`)
        .set("Authorization", `Bearer ${thirdUserToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].content).toBe("Hello group!");
    });
  });

  describe("Business Conversation Flow", () => {
    let businessConversationId: string;
    let businessId: string;

    beforeAll(async () => {
      businessId = uuidv4();
    });

    it("should create a business conversation", async () => {
      const response = await request(app.getHttpServer())
        .post("/conversations/business")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          businessId: businessId,
          subject: "Customer Support Inquiry",
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.type).toBe("business");
      expect(response.body.businessId).toBe(businessId);

      businessConversationId = response.body.id;
    });

    it("should send customer message to business", async () => {
      const messageContent = "I need help with my order";

      const response = await request(app.getHttpServer())
        .post(`/conversations/${businessConversationId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: messageContent,
        })
        .expect(201);

      expect(response.body.content).toBe(messageContent);
      expect(response.body.senderId).toBe(testUserId);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle invalid conversation ID", async () => {
      const invalidId = uuidv4();

      await request(app.getHttpServer())
        .get(`/conversations/${invalidId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should handle unauthorized conversation access", async () => {
      // Create conversation with one user
      const response = await request(app.getHttpServer())
        .post("/conversations/direct")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          participantId: otherUserId,
        })
        .expect(201);

      const conversationId = response.body.id;

      // Try to access with unauthorized user
      const unauthorizedToken = jwtService.sign({
        sub: uuidv4(),
        kahaId: `unauthorized-${Date.now()}`,
        iat: Math.floor(Date.now() / 1000),
      });

      await request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${unauthorizedToken}`)
        .expect(403);
    });

    it("should validate message content", async () => {
      const response = await request(app.getHttpServer())
        .post("/conversations/direct")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          participantId: otherUserId,
        })
        .expect(201);

      const conversationId = response.body.id;

      // Test empty message
      await request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "",
        })
        .expect(400);
    });

    it("should handle malformed JWT tokens", async () => {
      await request(app.getHttpServer())
        .get("/conversations")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });
  });
});
