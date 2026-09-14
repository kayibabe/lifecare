from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    employee_id: str
    password: str


class UserCreate(BaseModel):
    employee_id: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    password: str
    role: str
    department: str | None = None

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class CurrentUserResponse(BaseModel):
    id: str
    employee_id: str
    full_name: str
    role: str
    department: str | None
