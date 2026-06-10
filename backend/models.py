"""SQLAlchemy ORM models for Tool Permission Matrix."""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    Enum as SAEnum, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class RiskCategory(str, enum.Enum):
    """All 6 risk categories for tools and permissions."""
    READ_ONLY = "read-only"
    INTERNAL_WRITE = "internal-write"
    EXTERNAL_API = "external-api"
    FINANCIAL = "financial"
    DESTRUCTIVE = "destructive"
    ADMINISTRATIVE = "administrative"


class Tool(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    risk_category = Column(SAEnum(RiskCategory), nullable=False, default=RiskCategory.READ_ONLY)
    endpoint = Column(String(512), nullable=True)
    required_permissions = Column(Text, nullable=True)  # JSON string of required perms
    tags = Column(Text, nullable=True)  # JSON string array
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    permissions = relationship("Permission", back_populates="tool", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tool(id={self.id}, name='{self.name}', risk='{self.risk_category}')>"


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    parent_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    allowed_risk_levels = Column(Text, nullable=True)  # JSON string array of RiskCategory values
    is_system_role = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    parent_role = relationship("Role", remote_side=[id], backref="child_roles")
    permissions = relationship("Permission", back_populates="role", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}')>"


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("tool_id", "role_id", name="uq_tool_role"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool_id = Column(Integer, ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    allowed = Column(Boolean, nullable=False, default=False)
    inherited = Column(Boolean, nullable=False, default=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    tool = relationship("Tool", back_populates="permissions")
    role = relationship("Role", back_populates="permissions")

    def __repr__(self):
        return f"<Permission(tool={self.tool_id}, role={self.role_id}, allowed={self.allowed})>"