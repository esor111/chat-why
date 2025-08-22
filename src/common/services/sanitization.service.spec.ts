import { Test, TestingModule } from "@nestjs/testing";
import { SanitizationService } from "./sanitization.service";

describe("SanitizationService", () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("sanitizeMessageContent", () => {
    it("should trim whitespace", () => {
      const result = service.sanitizeMessageContent("  hello world  ");
      expect(result).toBe("hello world");
    });

    it("should remove null bytes and control characters", () => {
      const result = service.sanitizeMessageContent("hello\x00world\x01test");
      expect(result).toBe("helloworldtest"); // Control characters removed
    });

    it("should remove excessive whitespace", () => {
      const result = service.sanitizeMessageContent("hello   world    test");
      expect(result).toBe("hello  world  test");
    });

    it("should remove excessive newlines", () => {
      const result = service.sanitizeMessageContent("hello\n\n\n\nworld");
      expect(result).toBe("hello  world"); // 4 newlines become 2 spaces due to \s{3,} regex
    });

    it("should remove script tags", () => {
      const result = service.sanitizeMessageContent(
        'hello <script>alert("xss")</script> world'
      );
      expect(result).toBe("hello  world");
    });

    it("should remove javascript: URLs", () => {
      const result = service.sanitizeMessageContent(
        'click javascript:alert("xss") here'
      );
      expect(result).toBe('click alert("xss") here');
    });

    it("should return empty string for null/undefined input", () => {
      expect(service.sanitizeMessageContent(null as any)).toBe("");
      expect(service.sanitizeMessageContent(undefined as any)).toBe("");
      expect(service.sanitizeMessageContent("")).toBe("");
    });
  });

  describe("sanitizeSearchQuery", () => {
    it("should trim and normalize whitespace", () => {
      const result = service.sanitizeSearchQuery("  hello   world  ");
      expect(result).toBe("hello world");
    });

    it("should remove special characters", () => {
      const result = service.sanitizeSearchQuery('hello<>world"test');
      expect(result).toBe("helloworldtest");
    });

    it("should remove control characters", () => {
      const result = service.sanitizeSearchQuery("hello\x00world\x01test");
      expect(result).toBe("helloworldtest");
    });
  });

  describe("sanitizeConversationName", () => {
    it("should trim whitespace", () => {
      const result = service.sanitizeConversationName("  My Group  ");
      expect(result).toBe("My Group");
    });

    it("should remove HTML tags", () => {
      const result = service.sanitizeConversationName("My <b>Group</b> Chat");
      expect(result).toBe("My Group Chat");
    });

    it("should remove excessive whitespace", () => {
      const result = service.sanitizeConversationName("My   Group   Chat");
      expect(result).toBe("My Group Chat");
    });
  });

  describe("sanitizeUUID", () => {
    it("should return valid UUID in lowercase", () => {
      const uuid = "550E8400-E29B-41D4-A716-446655440000";
      const result = service.sanitizeUUID(uuid);
      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should return null for invalid UUID", () => {
      expect(service.sanitizeUUID("invalid-uuid")).toBeNull();
      expect(service.sanitizeUUID("123")).toBeNull();
      expect(service.sanitizeUUID("")).toBeNull();
      expect(service.sanitizeUUID(null as any)).toBeNull();
    });

    it("should clean UUID with extra characters", () => {
      const dirtyUuid = "550e8400-e29b-41d4-a716-446655440000!!!";
      const result = service.sanitizeUUID(dirtyUuid);
      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });
});
