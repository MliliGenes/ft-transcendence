var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, MaxLength, } from 'class-validator';
export class SendMessageDto {
    content;
    clientRequestId;
    attachments;
}
__decorate([
    Transform(({ value }) => typeof value === 'string' ? value.trim() : value),
    IsString(),
    Length(1, 2000),
    __metadata("design:type", String)
], SendMessageDto.prototype, "content", void 0);
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "clientRequestId", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMaxSize(5),
    IsString({ each: true }),
    MaxLength(200, { each: true }),
    __metadata("design:type", Array)
], SendMessageDto.prototype, "attachments", void 0);
//# sourceMappingURL=message.dto.js.map