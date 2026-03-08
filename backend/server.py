from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, validator, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import random
from collections import defaultdict


from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt

from bson import ObjectId

import cloudinary
import cloudinary.uploader
import io

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")




ROOT_DIR = Path(__file__).parent


# Cloudinary config from environment (optional - if not set we fall back to local storage)
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
CLOUDINARY_FOLDER = os.environ.get("CLOUDINARY_FOLDER", "ecom/uploads")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
else:
    # Log a warning so it's obvious in the server log that Cloudinary isn't configured
    logging.info("Cloudinary credentials not found in environment — image uploads will be saved locally.")

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ecommerce')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Simple in-memory cache for recommendations (TTL in seconds)
RECOMMEND_CACHE: Dict[str, Dict[str, Any]] = {}
RECOMMEND_TTL_SECONDS = 600


def normalize_mongo_for_json(value: Any) -> Any:
    """Recursively convert Mongo-specific values to JSON-safe Python values."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [normalize_mongo_for_json(item) for item in value]
    if isinstance(value, dict):
        return {k: normalize_mongo_for_json(v) for k, v in value.items()}
    return value

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

JWT_EXPIRATION_HOURS = 24 * 7  # 1 week

# Security
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Create the main app
app = FastAPI(title="E-Commerce API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")


@app.get("/")
async def app_root():
    """Root health endpoint for platform checks."""
    return {"message": "E-Commerce API is running", "api_prefix": "/api"}

# Add validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        msg = error["msg"]
        errors.append(f"{field}: {msg}")

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": errors
        }
    )

# CORS Middleware
default_origins = [
    "https://my-ecommerce-app-mocha.vercel.app",
    "https://shopmate-mocha.vercel.app",
    "https://shopmate.vercel.app",
    "https://my-ecommerce-app-otgm.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

# Optional override/additions via env, comma-separated.
# Example: CORS_ORIGINS=https://foo.vercel.app,https://bar.example.com
extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
origins = list(dict.fromkeys(default_origins + extra_origins))
allowed_origin_regex = (
    r"^https://(shopmate|my-ecommerce-app)(-[a-z0-9-]+)?\.vercel\.app$"
    r"|^https?://localhost(:\d+)?$"
    r"|^https?://127\.0\.0\.1(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ==================== MODELS ====================

class UserBase(BaseModel):
    name: str
    email: str
    role: str = "user"  # user or admin

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    login_otp: Optional[str] = None


class DeliveryAddress(BaseModel):
    full_name: str
    phone_number: str
    street: str
    city: str
    state: str
    postal_code: str
    country: str
    pincode: Optional[str] = None  # Make pincode optional for compatibility

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    delivery_address: Optional[DeliveryAddress] = None
    avatar_url: Optional[str] = None
    preferred_payment_method: Optional[str] = None
    language: Optional[str] = None
    notification_preference: Optional[str] = None

    @validator('mobile_number')
    def validate_mobile_number(cls, v):
        if v is not None and v.strip():  # Only validate if not empty after stripping
            # Remove any spaces, hyphens, or parentheses
            cleaned = re.sub(r'[\s\-\(\)]', '', v)
            # Check if it's only digits and has valid length
            if not cleaned.isdigit() or not (10 <= len(cleaned) <= 15):
                raise ValueError('Mobile number must contain only digits and be 10-15 characters long')
        elif v is not None and not v.strip():
            # If it's an empty string after stripping, set to None
            return None
        return v

    @validator('delivery_address')
    def validate_delivery_address(cls, v):
        if v is not None:
            # Clean the postal code (remove spaces, hyphens, etc.)
            cleaned_postal_code = v.postal_code.replace(' ', '').replace('-', '')
            if not cleaned_postal_code.isdigit():
                raise ValueError('Postal code must contain only digits')
            # Set pincode to postal_code for compatibility (if not already set)
            if not v.pincode:
                v.pincode = cleaned_postal_code
            # Update the postal_code with cleaned version
            v.postal_code = cleaned_postal_code
        return v

    @validator('preferred_payment_method')
    def validate_preferred_payment_method(cls, v):
        if v is None:
            return v
        allowed = {"card", "upi", "net_banking", "wallet", "cash_on_delivery"}
        if v not in allowed:
            raise ValueError('Invalid preferred payment method')
        return v

    @validator('language')
    def validate_language(cls, v):
        if v is None:
            return v
        allowed = {"en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur"}
        if v not in allowed:
            raise ValueError('Invalid language')
        return v

    @validator('notification_preference')
    def validate_notification_preference(cls, v):
        if v is None:
            return v
        allowed = {"all", "important_only", "none"}
        if v not in allowed:
            raise ValueError('Invalid notification preference')
        return v

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    mobile_number: Optional[str] = None
    delivery_address: Optional[Dict[str, Any]] = None  # Make it flexible to handle different address formats
    two_factor_enabled: Optional[bool] = False
    avatar_url: Optional[str] = None
    preferred_payment_method: Optional[str] = None
    language: Optional[str] = "en"
    notification_preference: Optional[str] = "all"



class ProductVariant(BaseModel):
    sku: str
    attributes: Dict[str, str] = {}  # Example: {"size": "M", "color": "Black"}
    price: Optional[float] = None
    stock: int = 0
    image: Optional[str] = None

class ProductBase(BaseModel):
    name: str
    price: float
    description: str
    category: str
    stock: int = 0
    images: List[str] = []
    brand: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None  # e.g., {"color": "Blue", "size": "L", "weight": "500g"}
    tags: Optional[List[str]] = []  # For better search
    variants: Optional[List[ProductVariant]] = []

    @validator('name')
    def validate_name_length(cls, v):
        if len(v) > 200:
            raise ValueError('Product name must not exceed 200 characters')
        return v

class ProductCreate(ProductBase):
    brand: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = []

class Product(ProductBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    average_rating: Optional[float] = 0.0
    total_ratings: Optional[int] = 0
    view_count: Optional[int] = 0  # Track product views

class OrderItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    price: float
    total: Optional[float] = None
    variant_sku: Optional[str] = None

class OrderBase(BaseModel):
    products: List[OrderItem]
    total_amount: float
    coupon_code: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    
class OrderCreate(OrderBase):
    pass

class Order(OrderBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Additional fields for orders
    user_email: Optional[str] = None
    status: Optional[str] = None
    delivery_address: Optional[DeliveryAddress] = None
    order_id: Optional[str] = None
    status_history: Optional[List[Dict[str, Any]]] = []

class SupportTicketBase(BaseModel):
    name: str
    email: EmailStr
    subject: str
    description: str
    status: str = "open"

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicket(SupportTicketBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    messages: List[Dict[str, Any]] = []

class FAQBase(BaseModel):
    question: str
    answer: str
    category: str

class FAQCreate(FAQBase):
    pass

class FAQ(FAQBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RatingBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)

class RatingCreate(RatingBase):
    pass

class Rating(RatingBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_purchase: Optional[bool] = False
    helpful_count: Optional[int] = 0
    report_count: Optional[int] = 0
    is_hidden: Optional[bool] = False

class ReviewVote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    review_id: str
    user_id: str
    vote: str  # helpful | report
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CartItemInput(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1)

class CartItemOut(BaseModel):
    product: Product
    quantity: int

class CartQuantityUpdate(BaseModel):
    quantity: int = Field(..., ge=0)

class ReturnRequestCreate(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1)
    reason: Optional[str] = None

class ReturnRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    order_id: str
    product_id: str
    quantity: int
    reason: Optional[str] = None
    status: str = "requested"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoginHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    login_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class DeleteAccountRequest(BaseModel):
    password: str

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    token_jti: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_revoked: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TwoFactorSetupResponse(BaseModel):
    setup_code: str
    message: str

class TwoFactorVerifyRequest(BaseModel):
    setup_code: str

class CouponBase(BaseModel):
    code: str
    discount_type: str  # percentage | fixed
    value: float = Field(..., gt=0)
    min_order_amount: float = 0
    max_discount_amount: Optional[float] = None
    is_active: bool = True
    is_public: bool = False
    description: Optional[str] = None
    usage_limit: Optional[int] = None
    expires_at: Optional[datetime] = None

class CouponCreate(CouponBase):
    pass

class CouponUpdate(BaseModel):
    discount_type: Optional[str] = None
    value: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    description: Optional[str] = None
    usage_limit: Optional[int] = None
    expires_at: Optional[datetime] = None

class Coupon(CouponBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    used_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PublicCoupon(BaseModel):
    code: str
    discount_type: str
    value: float
    min_order_amount: float
    max_discount_amount: Optional[float] = None
    expires_at: Optional[datetime] = None
    description: Optional[str] = None

class RecentlyViewed(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # None for guest users
    session_id: Optional[str] = None  # For guest tracking
    product_id: str
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductComparison(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    product_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))









# ==================== AUTH UTILITIES ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def is_strong_password(password: str) -> bool:
    """Minimum 8 chars, upper, lower, number, special char."""
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[^A-Za-z0-9]", password):
        return False
    return True

def build_status_event(status: str, actor: str = "system", note: Optional[str] = None) -> Dict[str, Any]:
    return {
        "status": status,
        "actor": actor,
        "note": note,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def normalize_utc_datetime(value: Optional[Any]) -> Optional[datetime]:
    if value is None:
        return None
    dt_value = value
    if isinstance(dt_value, str):
        dt_value = datetime.fromisoformat(dt_value.replace("Z", "+00:00"))
    if isinstance(dt_value, datetime) and dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=timezone.utc)
    return dt_value if isinstance(dt_value, datetime) else None

async def apply_coupon_if_valid(coupon_code: Optional[str], subtotal: float) -> Dict[str, Any]:
    if not coupon_code:
        return {"code": None, "discount_amount": 0.0}

    coupon = await db.coupons.find_one({"code": coupon_code.strip().upper()})
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")

    if not coupon.get("is_active", True):
        raise HTTPException(status_code=400, detail="Coupon is inactive")

    expires_at = normalize_utc_datetime(coupon.get("expires_at"))
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon has expired")

    usage_limit = coupon.get("usage_limit")
    if usage_limit is not None and coupon.get("used_count", 0) >= usage_limit:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")

    min_order = float(coupon.get("min_order_amount", 0) or 0)
    if subtotal < min_order:
        raise HTTPException(status_code=400, detail=f"Minimum order amount for this coupon is {min_order}")

    discount_type = coupon.get("discount_type")
    value = float(coupon.get("value", 0) or 0)
    if discount_type == "percentage":
        discount_amount = subtotal * (value / 100.0)
    elif discount_type == "fixed":
        discount_amount = value
    else:
        raise HTTPException(status_code=400, detail="Invalid coupon configuration")

    max_discount = coupon.get("max_discount_amount")
    if max_discount is not None:
        discount_amount = min(discount_amount, float(max_discount))

    discount_amount = max(0.0, min(discount_amount, subtotal))
    return {"code": coupon.get("code"), "discount_amount": round(discount_amount, 2)}


def create_access_token(user_id: str, email: str, role: str, token_jti: Optional[str] = None) -> str:
    jti = token_jti or str(uuid.uuid4())
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'jti': jti,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    token_jti = payload.get("jti")
    if token_jti:
        session_doc = await db.user_sessions.find_one({"token_jti": token_jti, "is_revoked": False})
        if not session_doc:
            raise HTTPException(status_code=401, detail="Session is no longer active")
        await db.user_sessions.update_one(
            {"token_jti": token_jti},
            {"$set": {"last_seen_at": datetime.now(timezone.utc)}}
        )
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Filter out fields that aren't in the User model
    user_data = {k: v for k, v in user.items() if k in User.__fields__}
    return User(**user_data)

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional)) -> Optional[User]:
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        token_jti = payload.get("jti")
        if token_jti:
            session_doc = await db.user_sessions.find_one({"token_jti": token_jti, "is_revoked": False})
            if not session_doc:
                return None
        user = await db.users.find_one({"id": payload["user_id"]})
        if not user:
            return None
        user_data = {k: v for k, v in user.items() if k in User.__fields__}
        return User(**user_data)
    except HTTPException:
        return None

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@api_router.get("/welcome")
async def welcome(request: Request):
    logging.info(f"Request received: {request.method} {request.path}")
    return {"message": "Welcome to the E-Commerce API!"}




@api_router.get("/")
async def root():
    return {"message": "E-Commerce API is running"}

# AUTH ROUTES

@api_router.post("/auth/login", response_model=dict)
async def login(login_data: UserLogin, request: Request):
    # Find user
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")



    # Verify password
    if not verify_password(login_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials") 

    # Optional 2FA verification
    if user_doc.get("two_factor_enabled"):
        expected_code = user_doc.get("two_factor_secret_code")
        if not login_data.login_otp or login_data.login_otp != expected_code:
            raise HTTPException(status_code=401, detail="Two-factor code is required or invalid")

    # Filter out fields that aren't in the User model
    user_data = {k: v for k, v in user_doc.items() if k != "password_hash" and k in User.__fields__}
    user = User(**user_data)

    # Log login history
    try:
        login_entry = LoginHistory(
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            device=request.headers.get("user-agent", "").split(" ")[0] if request.headers.get("user-agent") else None
        )
        await db.login_history.insert_one(login_entry.dict())
    except Exception as e:
        logging.warning(f"Failed to log login history: {e}")

    token_jti = str(uuid.uuid4())
    token = create_access_token(user.id, user.email, user.role, token_jti=token_jti)
    user_session = UserSession(
        user_id=user.id,
        token_jti=token_jti,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    await db.user_sessions.insert_one(user_session.dict())

    return {
        "access_token": token,
        "session_id": user_session.id,
        "user": user.dict(),
        "message": "Login successful"
    }

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    if not is_strong_password(user_data.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 chars and include uppercase, lowercase, number, and special character"
        )

    # Hash password
    hashed_password = hash_password(user_data.password)

    # Create user
    user = User(**user_data.dict())
    user_dict = user.dict()
    user_dict["password_hash"] = hashed_password

    await db.users.insert_one(user_dict)

    return {"message": "User registered successfully."}









@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/users/profile", response_model=User)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile information"""
    return current_user

@api_router.put("/users/profile", response_model=User)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    try:
        # Email change is intentionally blocked in profile edit.
        # Use a dedicated, verified flow (OTP/password re-auth) for email updates.
        if profile_data.email and profile_data.email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="Email update is restricted. Please use a verified security flow."
            )

        # Prepare update data
        update_data = {}
        if profile_data.name is not None:
            update_data["name"] = profile_data.name
        # Do not update email from this endpoint.
        if profile_data.mobile_number is not None:
            update_data["mobile_number"] = profile_data.mobile_number
        if profile_data.delivery_address is not None:
            update_data["delivery_address"] = profile_data.delivery_address.dict()
        if profile_data.avatar_url is not None:
            update_data["avatar_url"] = profile_data.avatar_url
        if profile_data.preferred_payment_method is not None:
            update_data["preferred_payment_method"] = profile_data.preferred_payment_method
        if profile_data.language is not None:
            update_data["language"] = profile_data.language
        if profile_data.notification_preference is not None:
            update_data["notification_preference"] = profile_data.notification_preference

        # Update user in database
        if update_data:
            result = await db.users.update_one(
                {"id": current_user.id},
                {"$set": update_data}
            )

            if result.matched_count == 0:
                logging.warning(f"Profile update found no user by id={current_user.id}. Trying fallback by email.")
                if current_user.email:
                    result = await db.users.update_one(
                        {"email": current_user.email},
                        {"$set": update_data}
                    )
                if result.matched_count == 0:
                    raise HTTPException(status_code=404, detail="User not found")

        # Fetch and return updated user
        updated_user_doc = await db.users.find_one({"id": current_user.id})
        if not updated_user_doc and current_user.email:
            updated_user_doc = await db.users.find_one({"email": current_user.email})
        if not updated_user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        # Filter out fields that aren't in the User model
        user_data = {k: v for k, v in updated_user_doc.items() if k in User.__fields__}
        return User(**user_data)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

@api_router.put("/users/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user)
):
    """Change user password"""
    try:
        # Get user document
        user_doc = await db.users.find_one({"id": current_user.id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify old password
        if not verify_password(password_data.old_password, user_doc["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if not is_strong_password(password_data.new_password):
            raise HTTPException(
                status_code=400,
                detail="New password must be at least 8 chars and include uppercase, lowercase, number, and special character"
            )

        # Hash new password
        new_hashed_password = hash_password(password_data.new_password)

        # Update password
        result = await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"password_hash": new_hashed_password}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update password")

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")



@api_router.delete("/users/delete-address")
async def delete_address(current_user: User = Depends(get_current_user)):
    """Delete user's delivery address"""
    try:
        result = await db.users.update_one(
            {"id": current_user.id},
            {"$unset": {"delivery_address": ""}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found or no address to delete")

        return {"message": "Address deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete address error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete address")

@api_router.get("/users/login-history")
async def get_login_history(current_user: User = Depends(get_current_user)):
    """Get user's login history"""
    try:
        login_history = await db.login_history.find(
            {"user_id": current_user.id}
        ).sort("login_time", -1).to_list(50)

        # Format the response
        history_list = []
        for entry in login_history:
            history_list.append({
                "id": entry["id"],
                "login_time": entry["login_time"].isoformat(),
                "ip_address": entry.get("ip_address", "Unknown"),
                "user_agent": entry.get("user_agent", "Unknown"),
                "device": entry.get("device", "Unknown")
            })

        return {"login_history": history_list}

    except Exception as e:
        logging.error(f"Login history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve login history")

@api_router.delete("/users/delete-account")
async def delete_account(
    delete_data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user)
):
    """Delete user account permanently"""
    try:
        # Verify password
        user_doc = await db.users.find_one({"id": current_user.id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(delete_data.password, user_doc["password_hash"]):
            raise HTTPException(status_code=400, detail="Password is incorrect")

        # Delete all user data
        await db.users.delete_one({"id": current_user.id})
        await db.login_history.delete_many({"user_id": current_user.id})
        await db.orders.delete_many({"user_id": current_user.id})
        await db.support_tickets.delete_many({"user_id": current_user.id})

        return {"message": "Account deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete account error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

@api_router.get("/users/sessions")
async def get_user_sessions(current_user: User = Depends(get_current_user)):
    sessions = await db.user_sessions.find(
        {"user_id": current_user.id, "is_revoked": False}
    ).sort("last_seen_at", -1).to_list(20)
    return {"sessions": sessions}

@api_router.delete("/users/sessions/{session_id}")
async def revoke_user_session(session_id: str, current_user: User = Depends(get_current_user)):
    result = await db.user_sessions.update_one(
        {"id": session_id, "user_id": current_user.id},
        {"$set": {"is_revoked": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session revoked"}

@api_router.post("/users/two-factor/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(current_user: User = Depends(get_current_user)):
    setup_code = f"{random.randint(100000, 999999)}"
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"two_factor_pending_code": setup_code}}
    )
    return TwoFactorSetupResponse(
        setup_code=setup_code,
        message="Use this setup code in your authenticator flow and verify to enable 2FA"
    )

@api_router.post("/users/two-factor/enable")
async def enable_two_factor(
    payload: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    expected = user_doc.get("two_factor_pending_code")
    if not expected or payload.setup_code != expected:
        raise HTTPException(status_code=400, detail="Invalid setup code")

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"two_factor_enabled": True, "two_factor_secret_code": payload.setup_code},
         "$unset": {"two_factor_pending_code": ""}}
    )
    return {"message": "Two-factor authentication enabled"}

@api_router.post("/users/two-factor/disable")
async def disable_two_factor(
    delete_data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user)
):
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(delete_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"two_factor_enabled": False}, "$unset": {"two_factor_secret_code": "", "two_factor_pending_code": ""}}
    )
    return {"message": "Two-factor authentication disabled"}

# ADMIN USER MANAGEMENT ROUTES
@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(admin_user: User = Depends(get_admin_user)):
    users = await db.users.find({}).to_list(100)
    # Filter out fields that aren't in the User model and handle ObjectId
    filtered_users = []
    for user in users:
        user_data = {k: v for k, v in user.items() if k != "password_hash" and k in User.__fields__}
        # Convert ObjectId to string if present
        if "_id" in user_data:
            user_data["id"] = str(user_data["_id"])
            del user_data["_id"]
        filtered_users.append(User(**user_data))
    return filtered_users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin_user: User = Depends(get_admin_user)):
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# COUPON ROUTES
@api_router.get("/admin/coupons", response_model=List[Coupon])
async def get_admin_coupons(admin_user: User = Depends(get_admin_user)):
    coupons = await db.coupons.find({}).sort("created_at", -1).to_list(200)
    return [Coupon(**c) for c in coupons]

@api_router.post("/admin/coupons", response_model=Coupon)
async def create_coupon(coupon_data: CouponCreate, admin_user: User = Depends(get_admin_user)):
    code = coupon_data.code.strip().upper()
    if coupon_data.discount_type not in ["percentage", "fixed"]:
        raise HTTPException(status_code=400, detail="discount_type must be percentage or fixed")
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = Coupon(**{**coupon_data.dict(), "code": code})
    await db.coupons.insert_one(coupon.dict())
    return coupon

@api_router.put("/admin/coupons/{coupon_id}", response_model=Coupon)
async def update_coupon(coupon_id: str, coupon_data: CouponUpdate, admin_user: User = Depends(get_admin_user)):
    update_payload = {k: v for k, v in coupon_data.dict().items() if v is not None}
    if "discount_type" in update_payload and update_payload["discount_type"] not in ["percentage", "fixed"]:
        raise HTTPException(status_code=400, detail="discount_type must be percentage or fixed")
    if not update_payload:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = await db.coupons.update_one({"id": coupon_id}, {"$set": update_payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    updated = await db.coupons.find_one({"id": coupon_id})
    return Coupon(**updated)

@api_router.delete("/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.coupons.delete_one({"id": coupon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted successfully"}

@api_router.get("/coupons/available", response_model=List[PublicCoupon])
async def get_available_coupons():
    now_utc = datetime.now(timezone.utc)
    coupons = await db.coupons.find({
        "is_active": True,
        "$or": [
            {"is_public": True},
            {"is_public": "true"},
            {"is_public": "True"},
            {"is_public": 1}
        ]
    }).sort("created_at", -1).to_list(200)
    available: List[PublicCoupon] = []

    for coupon in coupons:
        expires_at = normalize_utc_datetime(coupon.get("expires_at"))
        if expires_at and expires_at < now_utc:
            continue

        usage_limit = coupon.get("usage_limit")
        if usage_limit is not None and coupon.get("used_count", 0) >= usage_limit:
            continue

        available.append(
            PublicCoupon(
                code=coupon.get("code"),
                discount_type=coupon.get("discount_type"),
                value=float(coupon.get("value", 0) or 0),
                min_order_amount=float(coupon.get("min_order_amount", 0) or 0),
                max_discount_amount=float(coupon.get("max_discount_amount")) if coupon.get("max_discount_amount") is not None else None,
                expires_at=expires_at,
                description=coupon.get("description")
            )
        )

    return available

@api_router.get("/coupons/validate")
async def validate_coupon(code: str = Query(...), cart_total: float = Query(..., ge=0)):
    coupon_meta = await apply_coupon_if_valid(code, cart_total)
    final_total = round(float(cart_total) - float(coupon_meta["discount_amount"]), 2)
    return {
        "coupon_code": coupon_meta["code"],
        "discount_amount": coupon_meta["discount_amount"],
        "final_total": max(0.0, final_total)
    }

# PRODUCT ROUTES
@api_router.get("/products", response_model=List[Product])
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock: Optional[bool] = None,
    min_rating: Optional[float] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    tags: Optional[str] = None,
    has_variants: Optional[bool] = None,
    min_stock: Optional[int] = None,
    limit: Optional[int] = 100
):
    query: Dict[str, Any] = {}
    if category:
        categories = [c.strip() for c in category.split(",") if c.strip()]
        if len(categories) == 1:
            query["category"] = categories[0]
        elif categories:
            query["category"] = {"$in": categories}
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if search:
        # Enhanced search - search in name, description, brand, tags, and category
        terms = [t.strip() for t in search.split() if t.strip()]
        search_conditions = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}},
            {"category": {"$regex": search, "$options": "i"}}
        ]
        if terms:
            for term in terms:
                query.setdefault("$and", []).append({
                    "$or": [
                        {"name": {"$regex": term, "$options": "i"}},
                        {"description": {"$regex": term, "$options": "i"}},
                        {"brand": {"$regex": term, "$options": "i"}},
                        {"tags": {"$in": [term]}},
                        {"category": {"$regex": term, "$options": "i"}}
                    ]
                })
        else:
            query["$or"] = search_conditions
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            query["tags"] = {"$all": tag_list}
    price_filter: Dict[str, Any] = {}
    if min_price is not None:
        price_filter["$gte"] = float(min_price)
    if max_price is not None:
        price_filter["$lte"] = float(max_price)
    if price_filter:
        query["price"] = price_filter
    if in_stock:
        query["stock"] = {"$gt": 0}
    if min_stock is not None:
        query["stock"] = {"$gte": max(0, int(min_stock))}
    if has_variants is not None:
        query["variants.0"] = {"$exists": bool(has_variants)}

    products = await db.products.find(query).to_list(100)
    valid_products: List[Product] = []

    for product in products:
        try:
            ratings_pipeline = [
                {"$match": {"product_id": product["id"]}},
                {"$group": {
                    "_id": "$product_id",
                    "average_rating": {"$avg": "$rating"},
                    "total_ratings": {"$sum": 1}
                }}
            ]
            rating_stats = await db.ratings.aggregate(ratings_pipeline).to_list(1)
            if rating_stats:
                product["average_rating"] = rating_stats[0]["average_rating"]
                product["total_ratings"] = rating_stats[0]["total_ratings"]
            else:
                product["average_rating"] = 0
                product["total_ratings"] = 0
            valid_products.append(Product(**product))
        except Exception as e:
            logging.warning(f"Skipping invalid product {product.get('id', 'unknown')}: {e}")
            continue

    if min_rating is not None:
        try:
            min_rating_val = float(min_rating)
            valid_products = [p for p in valid_products if (p.average_rating or 0) >= min_rating_val]
        except Exception:
            pass

    if sort_by:
        key_map = {
            "price": lambda p: p.price,
            "rating": lambda p: p.average_rating or 0,
            "created_at": lambda p: p.created_at,
            "stock": lambda p: p.stock,
            "popularity": lambda p: p.view_count or 0,  # Sort by views
            "name": lambda p: p.name.lower(),
            "newest": lambda p: p.created_at
        }
        key_func = key_map.get(sort_by)
        if key_func:
            reverse = (str(sort_order).lower() == "desc")
            try:
                valid_products.sort(key=key_func, reverse=reverse)
            except Exception:
                pass
    return valid_products[:limit] if limit else valid_products

# RECENTLY VIEWED PRODUCTS (must be before parameterized routes)
@api_router.get("/products/recently-viewed", response_model=List[Product])
async def get_recently_viewed(request: Request, current_user: Optional[User] = Depends(get_optional_user), limit: int = 10):
    """Get recently viewed products for user or session"""
    try:
        session_id = request.headers.get("x-session-id")
        
        query = {}
        if current_user:
            query["user_id"] = current_user.id
        elif session_id:
            query["session_id"] = session_id
        else:
            return []
        
        # Get recently viewed product IDs (last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        query["viewed_at"] = {"$gte": thirty_days_ago}
        
        viewed_docs = await db.recently_viewed.find(query).sort("viewed_at", -1).to_list(limit)
        product_ids = [doc["product_id"] for doc in viewed_docs]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_ids = []
        for pid in product_ids:
            if pid not in seen:
                seen.add(pid)
                unique_ids.append(pid)
        
        # Fetch products
        products_cursor = db.products.find({"id": {"$in": unique_ids}})
        products = []
        async for p in products_cursor:
            try:
                products.append(Product(**p))
            except Exception:
                continue
        
        # Sort by original view order
        products_dict = {p.id: p for p in products}
        sorted_products = [products_dict[pid] for pid in unique_ids if pid in products_dict]
        
        return sorted_products
    except Exception as e:
        logging.error(f"Error getting recently viewed: {e}")
        return []

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, admin_user: User = Depends(get_admin_user)):
    product_payload = product_data.dict()
    variants = product_payload.get("variants") or []
    if variants:
        # When variants are present, top-level stock mirrors variant inventory.
        product_payload["stock"] = sum(max(0, int(v.get("stock", 0))) for v in variants)
    product = Product(**product_payload)
    await db.products.insert_one(product.dict())
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductCreate, admin_user: User = Depends(get_admin_user)):
    product_payload = product_data.dict()
    variants = product_payload.get("variants") or []
    if variants:
        product_payload["stock"] = sum(max(0, int(v.get("stock", 0))) for v in variants)
    product = Product(**product_payload)
    product.id = product_id
    result = await db.products.replace_one({"id": product_id}, product.dict())
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin_user: User = Depends(get_admin_user)):
    logging.info(f"Attempting to delete product with ID: {product_id}")

    # First, check if product exists with any query method
    product_by_id = await db.products.find_one({"id": product_id})
    product_by_objectid = None
    if ObjectId.is_valid(product_id):
        try:
            product_by_objectid = await db.products.find_one({"_id": ObjectId(product_id)})
        except Exception:
            pass

    logging.info(f"Product by id field: {product_by_id is not None}")
    logging.info(f"Product by _id field: {product_by_objectid is not None}")

    # Try to delete by id field first
    result = await db.products.delete_one({"id": product_id})

    # If not found and product_id looks like ObjectId, try by _id
    if result.deleted_count == 0:
        try:
            if ObjectId.is_valid(product_id):
                result = await db.products.delete_one({"_id": ObjectId(product_id)})
        except Exception as e:
            logging.warning(f"ObjectId conversion failed: {e}")

    logging.info(f"Delete result - deleted_count: {result.deleted_count}")

    if result.deleted_count == 0:
        # Log all products for debugging
        all_products = await db.products.find({}).limit(10).to_list(10)
        product_ids = [str(p.get('id', p.get('_id', 'no-id'))) for p in all_products]
        logging.error(f"Product {product_id} not found. Available products: {product_ids}")
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

@api_router.get("/products/{product_id}/ratings")
async def get_product_ratings(product_id: str):
    """Get all ratings for a product"""
    try:
        ratings_cursor = db.ratings.find({"product_id": product_id})
        ratings = []
        async for rating_doc in ratings_cursor:
            # Convert ObjectId to string and create Rating object
            rating_data = {k: v for k, v in rating_doc.items() if k != "_id"}
            if "_id" in rating_doc:
                rating_data["id"] = str(rating_doc["_id"])
            ratings.append(Rating(**rating_data))
        return ratings
    except Exception as e:
        logging.error(f"Get ratings error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get ratings")

@api_router.post("/products/{product_id}/ratings")
async def submit_product_rating(
    product_id: str,
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user)
):
    """Submit a rating for a product"""
    try:
        # Check if product exists
        product = await db.products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Check if user already rated this product
        existing_rating = await db.ratings.find_one({
            "user_id": current_user.id,
            "product_id": product_id
        })

        if existing_rating:
            raise HTTPException(status_code=400, detail="You have already rated this product and cannot change your rating.")

        # Create new rating
        rating = Rating(
            user_id=current_user.id,
            product_id=product_id,
            rating=rating_data.rating
        )
        await db.ratings.insert_one(rating.dict())

        # Recalculate and update product's average rating and total ratings
        ratings_pipeline = [
            {"$match": {"product_id": product_id}},
            {"$group": {
                "_id": "$product_id",
                "average_rating": {"$avg": "$rating"},
                "total_ratings": {"$sum": 1}
            }}
        ]

        rating_stats = await db.ratings.aggregate(ratings_pipeline).to_list(1)

        if rating_stats:
            await db.products.update_one(
                {"id": product_id},
                {"$set": {
                    "average_rating": rating_stats[0]["average_rating"],
                    "total_ratings": rating_stats[0]["total_ratings"]
                }}
            )

        return {"message": "Rating submitted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Submit rating error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit rating")

@api_router.get("/products/{product_id}/reviews")
async def get_product_reviews(product_id: str, include_hidden: bool = False, admin_user: Optional[User] = Depends(get_optional_user)):
    try:
        query: Dict[str, Any] = {"product_id": product_id}
        if not include_hidden or not admin_user or admin_user.role != "admin":
            query["is_hidden"] = {"$ne": True}
        reviews_cursor = db.reviews.find(query).sort("created_at", -1)
        reviews = []
        async for review_doc in reviews_cursor:
            data = {k: v for k, v in review_doc.items() if k != "_id"}
            if "_id" in review_doc:
                data["id"] = str(review_doc["_id"])
            reviews.append(Review(**data))
        return reviews
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to get reviews")

@api_router.post("/products/{product_id}/reviews")
async def submit_product_review(
    product_id: str,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user)
):
    try:
        product = await db.products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        existing_review = await db.reviews.find_one({
            "user_id": current_user.id,
            "product_id": product_id
        })
        if existing_review:
            raise HTTPException(status_code=400, detail="You have already reviewed this product.")

        delivered_order = await db.orders.find_one({
            "user_id": current_user.id,
            "status": "delivered",
            "products": {"$elemMatch": {"product_id": product_id}}
        })
        review = Review(
            user_id=current_user.id,
            product_id=product_id,
            text=review_data.text,
            verified_purchase=bool(delivered_order)
        )
        await db.reviews.insert_one(review.dict())
        return {"message": "Review submitted successfully"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to submit review")

@api_router.post("/products/{product_id}/reviews/{review_id}/helpful")
async def vote_review_helpful(
    product_id: str,
    review_id: str,
    current_user: User = Depends(get_current_user)
):
    review = await db.reviews.find_one({"id": review_id, "product_id": product_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    existing = await db.review_votes.find_one({
        "review_id": review_id,
        "user_id": current_user.id,
        "vote": "helpful"
    })
    if existing:
        await db.review_votes.delete_one({"id": existing["id"]})
        await db.reviews.update_one({"id": review_id}, {"$inc": {"helpful_count": -1}})
        return {"message": "Helpful vote removed"}

    vote = ReviewVote(review_id=review_id, user_id=current_user.id, vote="helpful")
    await db.review_votes.insert_one(vote.dict())
    await db.reviews.update_one({"id": review_id}, {"$inc": {"helpful_count": 1}})
    return {"message": "Marked as helpful"}

@api_router.put("/admin/reviews/{review_id}/moderate")
async def moderate_review(review_id: str, hide: bool = Query(...), admin_user: User = Depends(get_admin_user)):
    result = await db.reviews.update_one({"id": review_id}, {"$set": {"is_hidden": hide}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Review moderation updated", "hidden": hide}

@api_router.get("/wishlist", response_model=List[Product])
async def get_wishlist(current_user: User = Depends(get_current_user)):
    wishlist_doc = await db.wishlists.find_one({"user_id": current_user.id})
    product_ids = wishlist_doc.get("product_ids", []) if wishlist_doc else []
    if not product_ids:
        return []
    products_cursor = db.products.find({"id": {"$in": product_ids}})
    products = []
    async for p in products_cursor:
        try:
            products.append(Product(**p))
        except Exception:
            continue
    return products

@api_router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.wishlists.update_one(
        {"user_id": current_user.id},
        {"$addToSet": {"product_ids": product_id}},
        upsert=True
    )
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, current_user: User = Depends(get_current_user)):
    await db.wishlists.update_one(
        {"user_id": current_user.id},
        {"$pull": {"product_ids": product_id}},
        upsert=True
    )
    return {"message": "Removed from wishlist"}

@api_router.get("/cart", response_model=List[CartItemOut])
async def get_cart(current_user: User = Depends(get_current_user)):
    cart_doc = await db.carts.find_one({"user_id": current_user.id})
    if not cart_doc or not cart_doc.get("items"):
        return []
    out = []
    for item in cart_doc.get("items", []):
        product = await db.products.find_one({"id": item.get("product_id")})
        if not product:
            continue
        try:
            out.append(CartItemOut(product=Product(**product), quantity=int(item.get("quantity", 1))))
        except Exception:
            continue
    return out

@api_router.post("/cart/add")
async def add_to_cart(item: CartItemInput, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    cart_doc = await db.carts.find_one({"user_id": current_user.id})
    items = cart_doc.get("items", []) if cart_doc else []
    updated = False
    for i in items:
        if i.get("product_id") == item.product_id:
            i["quantity"] = int(i.get("quantity", 1)) + item.quantity
            updated = True
            break
    if not updated:
        items.append({"product_id": item.product_id, "quantity": item.quantity})
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"message": "Added to cart"}

@api_router.put("/cart/{product_id}")
async def update_cart_item(product_id: str, payload: CartQuantityUpdate, current_user: User = Depends(get_current_user)):
    cart_doc = await db.carts.find_one({"user_id": current_user.id})
    items = cart_doc.get("items", []) if cart_doc else []
    found = False
    for i in items:
        if i.get("product_id") == product_id:
            found = True
            if payload.quantity <= 0:
                items = [x for x in items if x.get("product_id") != product_id]
            else:
                i["quantity"] = payload.quantity
            break
    if not found and payload.quantity > 0:
        items.append({"product_id": product_id, "quantity": payload.quantity})
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"message": "Cart updated"}

@api_router.delete("/cart/{product_id}")
async def remove_cart_item(product_id: str, current_user: User = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"message": "Item removed"}

@api_router.post("/cart/clear")
async def clear_cart(current_user: User = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": current_user.id},
        {"$set": {"items": []}},
        upsert=True
    )
    return {"message": "Cart cleared"}

@api_router.get("/returns", response_model=List[ReturnRequest])
async def get_returns(current_user: User = Depends(get_current_user)):
    cursor = db.returns.find({"user_id": current_user.id}).sort("created_at", -1)
    res: List[ReturnRequest] = []
    async for doc in cursor:
        data = {k: v for k, v in doc.items() if k != "_id"}
        if "_id" in doc:
            data["id"] = str(doc["_id"])
        try:
            res.append(ReturnRequest(**data))
        except Exception:
            continue
    return res

@api_router.post("/orders/{order_id}/returns", response_model=ReturnRequest)
async def request_return(order_id: str, payload: ReturnRequestCreate, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    item = None
    for it in order.get("products", []):
        if it.get("product_id") == payload.product_id:
            item = it
            break
    if not item:
        raise HTTPException(status_code=400, detail="Product not in order")
    qty = int(payload.quantity)
    if qty <= 0 or qty > int(item.get("quantity", 0)):
        raise HTTPException(status_code=400, detail="Invalid quantity")
    # Prevent duplicate or excessive refund/return requests
    existing_cursor = db.returns.find({
        "user_id": current_user.id,
        "order_id": order_id,
        "product_id": payload.product_id
    })
    processed_qty = 0
    has_pending = False
    async for doc in existing_cursor:
        status = str(doc.get("status", "requested")).lower()
        q = int(doc.get("quantity", 0))
        if status in ("requested", "approved"):
            has_pending = True
        elif status in ("refunded", "received"):
            processed_qty += max(0, q)
        # rejected or other statuses are ignored for processed_qty
    remaining_qty = int(item.get("quantity", 0)) - processed_qty
    if remaining_qty <= 0:
        raise HTTPException(status_code=400, detail="This item has already been refunded/returned")
    if qty > remaining_qty:
        raise HTTPException(status_code=400, detail=f"Only {remaining_qty} unit(s) eligible for refund/return")
    if has_pending:
        raise HTTPException(status_code=400, detail="A return/refund request is already in progress for this item")
    ret = ReturnRequest(
        user_id=current_user.id,
        order_id=order_id,
        product_id=payload.product_id,
        quantity=qty,
        reason=payload.reason,
        status="requested"
    )
    await db.returns.insert_one(ret.dict())
    return ret

class ReturnUpdate(BaseModel):
    status: str

@api_router.get("/admin/returns", response_model=List[ReturnRequest])
async def admin_get_returns(admin_user: User = Depends(get_admin_user)):
    cursor = db.returns.find({}).sort("created_at", -1)
    res: List[ReturnRequest] = []
    async for doc in cursor:
        data = {k: v for k, v in doc.items() if k != "_id"}
        if "_id" in doc:
            data["id"] = str(doc["_id"])
        try:
            res.append(ReturnRequest(**data))
        except Exception:
            continue
    return res

@api_router.put("/admin/returns/{return_id}", response_model=ReturnRequest)
async def admin_update_return(return_id: str, update: ReturnUpdate, admin_user: User = Depends(get_admin_user)):
    ret_doc = await db.returns.find_one({"id": return_id})
    if not ret_doc and ObjectId.is_valid(return_id):
        try:
            ret_doc = await db.returns.find_one({"_id": ObjectId(return_id)})
        except Exception:
            pass
    if not ret_doc:
        raise HTTPException(status_code=404, detail="Return not found")
    await db.returns.update_one(
        {"id": ret_doc.get("id", return_id)},
        {"$set": {"status": update.status}}
    )
    updated = await db.returns.find_one({"id": ret_doc.get("id", return_id)})
    if not updated and ObjectId.is_valid(return_id):
        updated = await db.returns.find_one({"_id": ObjectId(return_id)})
        if updated and "_id" in updated:
            updated["id"] = str(updated["_id"])
    data = {k: v for k, v in (updated or {}).items() if k != "_id"}
    return ReturnRequest(**data)

@api_router.post("/admin/returns/{return_id}/restock")
async def admin_restock_return(return_id: str, admin_user: User = Depends(get_admin_user)):
    ret_doc = await db.returns.find_one({"id": return_id})
    if not ret_doc and ObjectId.is_valid(return_id):
        try:
            ret_doc = await db.returns.find_one({"_id": ObjectId(return_id)})
        except Exception:
            pass
    if not ret_doc:
        raise HTTPException(status_code=404, detail="Return not found")
    product_id = ret_doc.get("product_id")
    qty = int(ret_doc.get("quantity", 0))
    if not product_id or qty <= 0:
        raise HTTPException(status_code=400, detail="Invalid return data for restock")
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    new_stock = int(product.get("stock", 0)) + qty
    await db.products.update_one({"id": product_id}, {"$set": {"stock": new_stock}})
    await db.returns.update_one({"id": ret_doc.get("id", return_id)}, {"$set": {"status": "received"}})
    return {"message": "Product restocked", "product_id": product_id, "new_stock": new_stock}

@api_router.get("/products/{product_id}/recommendations", response_model=List[Product])
async def get_product_recommendations(product_id: str, limit: int = 8, current_user: Optional[User] = Depends(get_optional_user)):
    now = datetime.now(timezone.utc)
    cached = RECOMMEND_CACHE.get(product_id)
    if cached and (now - cached.get("ts", now)).total_seconds() < RECOMMEND_TTL_SECONDS:
        try:
            products_cursor = db.products.find({"id": {"$in": cached.get("ids", [])[:limit]}})
            out: List[Product] = []
            async for p in products_cursor:
                out.append(Product(**p))
            return out
        except Exception:
            pass
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Co-purchase signals
    orders_with_product = await db.orders.find({"products.product_id": product_id}).to_list(500)
    co_counts: Dict[str, int] = {}
    for order in orders_with_product:
        for it in order.get("products", []):
            pid = it.get("product_id")
            if pid and pid != product_id:
                qty = int(it.get("quantity", 1))
                co_counts[pid] = co_counts.get(pid, 0) + qty
    co_sorted = sorted(co_counts.items(), key=lambda x: x[1], reverse=True)
    co_ids = [pid for pid, _ in co_sorted]

    # Trending signals (last 30 days)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    recent_orders = await db.orders.find({"created_at": {"$gte": since.isoformat()}}).to_list(1000)
    trend_counts: Dict[str, int] = {}
    for o in recent_orders:
        for it in o.get("products", []):
            pid = it.get("product_id")
            if pid:
                qty = int(it.get("quantity", 1))
                trend_counts[pid] = trend_counts.get(pid, 0) + qty
    trend_sorted = sorted(trend_counts.items(), key=lambda x: x[1], reverse=True)
    trend_ids = [pid for pid, _ in trend_sorted if pid != product_id]

    # Category fallback
    category = product.get("category")
    same_category = await db.products.find({"category": category, "id": {"$ne": product_id}}).to_list(50)
    category_ids = [p.get("id") for p in same_category if p.get("id")]

    merged_ids: List[str] = []
    for pid_list in [co_ids, trend_ids, category_ids]:
        for pid in pid_list:
            if pid and pid not in merged_ids:
                merged_ids.append(pid)

    if current_user:
        since_user = datetime.now(timezone.utc) - timedelta(days=180)
        user_orders = await db.orders.find({"user_id": current_user.id, "created_at": {"$gte": since_user.isoformat()}}).to_list(1000)
        cat_counts: Dict[str, int] = {}
        bought_ids: Dict[str, int] = {}
        for o in user_orders:
            for it in o.get("products", []):
                pid = it.get("product_id")
                if pid:
                    bought_ids[pid] = bought_ids.get(pid, 0) + int(it.get("quantity", 1))
                    prod = await db.products.find_one({"id": pid})
                    if prod:
                        c = prod.get("category")
                        if c:
                            cat_counts[c] = cat_counts.get(c, 0) + int(it.get("quantity", 1))
        top_cats = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
        top_cat_set = {c for c, _ in top_cats[:3]}
        scored: List[tuple] = []
        for pid in merged_ids:
            base = 0
            if pid in co_ids:
                base += 3
            if pid in trend_ids:
                base += 2
            try:
                prod = await db.products.find_one({"id": pid})
                cat = prod.get("category") if prod else None
            except Exception:
                cat = None
            if cat in top_cat_set:
                base += 4
            if pid in bought_ids:
                base -= 3
            scored.append((pid, base))
        scored.sort(key=lambda x: x[1], reverse=True)
        merged_ids = [pid for pid, _ in scored]

    # Fetch product documents
    products_cursor = db.products.find({"id": {"$in": merged_ids[:limit]}})
    out: List[Product] = []
    async for p in products_cursor:
        try:
            out.append(Product(**p))
        except Exception:
            continue
    RECOMMEND_CACHE[product_id] = {"ids": merged_ids, "ts": now}
    return out

# RECENTLY VIEWED PRODUCTS
@api_router.post("/products/{product_id}/view")
async def track_product_view(product_id: str, request: Request, current_user: Optional[User] = Depends(get_optional_user)):
    """Track when a user views a product"""
    try:
        # Increment view count for the product
        await db.products.update_one(
            {"id": product_id},
            {"$inc": {"view_count": 1}}
        )
        
        # Track in recently viewed
        session_id = request.headers.get("x-session-id") or str(uuid.uuid4())
        
        # Check if already viewed recently (within last hour)
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        existing = await db.recently_viewed.find_one({
            "product_id": product_id,
            "$or": [
                {"user_id": current_user.id if current_user else None},
                {"session_id": session_id}
            ],
            "viewed_at": {"$gte": one_hour_ago}
        })
        
        if not existing:
            recently_viewed = RecentlyViewed(
                user_id=current_user.id if current_user else None,
                session_id=session_id if not current_user else None,
                product_id=product_id
            )
            await db.recently_viewed.insert_one(recently_viewed.dict())
        
        return {"message": "View tracked", "session_id": session_id}
    except Exception as e:
        logging.error(f"Error tracking view: {e}")
        return {"message": "View tracking failed", "error": str(e)}

# ANALYTICS ENDPOINTS
@api_router.get("/admin/analytics/sales-overview")
async def get_sales_analytics(admin_user: User = Depends(get_admin_user), days: int = 30):
    """Get sales analytics for the specified number of days"""
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Get all orders (we'll filter by date after fetching)
        # MongoDB created_at can be either datetime object or ISO string
        orders = await db.orders.find({
            "status": {"$ne": "cancelled"}
        }).to_list(10000)
        
        # Filter orders by date
        filtered_orders = []
        for order in orders:
            created_at = order.get("created_at")
            if created_at:
                # Handle both datetime objects and ISO strings
                if isinstance(created_at, str):
                    order_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    order_date = created_at
                
                # Make timezone-aware if needed
                if order_date.tzinfo is None:
                    order_date = order_date.replace(tzinfo=timezone.utc)
                
                if order_date >= start_date:
                    filtered_orders.append(order)
        
        orders = filtered_orders
        
        # Calculate metrics
        total_revenue = sum(order.get("total_amount", 0) for order in orders)
        total_orders = len(orders)
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        # Sales by day
        daily_sales = {}
        for order in orders:
            try:
                order_date = datetime.fromisoformat(order.get("created_at"))
                date_str = order_date.strftime("%Y-%m-%d")
                daily_sales[date_str] = daily_sales.get(date_str, 0) + order.get("total_amount", 0)
            except Exception:
                continue
        
        # Top products by revenue
        product_revenue = {}
        for order in orders:
            for item in order.get("products", []):
                pid = item.get("product_id")
                revenue = item.get("price", 0) * item.get("quantity", 1)
                product_revenue[pid] = product_revenue.get(pid, 0) + revenue
        
        top_products = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:10]
        top_products_data = []
        for pid, revenue in top_products:
            product = await db.products.find_one({"id": pid})
            if product:
                top_products_data.append({
                    "product_id": pid,
                    "name": product.get("name"),
                    "revenue": revenue,
                    "image": product.get("images", [])[0] if product.get("images") else None
                })
        
        return {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "average_order_value": round(avg_order_value, 2),
            "daily_sales": daily_sales,
            "top_products": top_products_data
        }
    except Exception as e:
        logging.error(f"Error getting sales analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

@api_router.get("/admin/analytics/product-performance")
async def get_product_performance(admin_user: User = Depends(get_admin_user)):
    """Get product performance metrics"""
    try:
        # Get all products with view counts and sales
        products = await db.products.find({}).to_list(1000)
        
        # Calculate sales for each product
        orders = await db.orders.find({"status": {"$ne": "cancelled"}}).to_list(10000)
        product_sales = {}
        for order in orders:
            for item in order.get("products", []):
                pid = item.get("product_id")
                qty = item.get("quantity", 0)
                product_sales[pid] = product_sales.get(pid, 0) + qty
        
        # Build performance data
        performance_data = []
        for product in products:
            pid = product.get("id")
            performance_data.append({
                "product_id": pid,
                "name": product.get("name"),
                "view_count": product.get("view_count", 0),
                "sales_count": product_sales.get(pid, 0),
                "conversion_rate": round((product_sales.get(pid, 0) / product.get("view_count", 1)) * 100, 2) if product.get("view_count", 0) > 0 else 0,
                "current_stock": product.get("stock", 0),
                "average_rating": product.get("average_rating", 0)
            })
        
        # Sort by sales count
        performance_data.sort(key=lambda x: x["sales_count"], reverse=True)
        
        return {
            "products": performance_data[:50]  # Top 50 products
        }
    except Exception as e:
        logging.error(f"Error getting product performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to get product performance")

@api_router.get("/admin/analytics/cart-abandonment")
async def get_cart_abandonment(admin_user: User = Depends(get_admin_user)):
    """Get cart abandonment metrics"""
    try:
        # Get all users with items in cart
        carts = await db.carts.find({"items": {"$exists": True, "$ne": []}}).to_list(10000)
        total_carts = len(carts)
        
        # Get orders placed in last 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        all_orders = await db.orders.find({}).to_list(10000)
        
        # Filter orders by date
        orders = []
        for order in all_orders:
            created_at = order.get("created_at")
            if created_at:
                if isinstance(created_at, str):
                    order_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    order_date = created_at
                if order_date.tzinfo is None:
                    order_date = order_date.replace(tzinfo=timezone.utc)
                if order_date >= thirty_days_ago:
                    orders.append(order)
        
        user_ids_with_orders = set(order.get("user_id") for order in orders)
        
        # Count abandoned carts (users with cart items but no recent orders)
        abandoned_count = 0
        for cart in carts:
            if cart.get("user_id") not in user_ids_with_orders:
                abandoned_count += 1
        
        abandonment_rate = (abandoned_count / total_carts * 100) if total_carts > 0 else 0
        
        return {
            "total_active_carts": total_carts,
            "abandoned_carts": abandoned_count,
            "abandonment_rate": round(abandonment_rate, 2),
            "conversion_rate": round(100 - abandonment_rate, 2)
        }
    except Exception as e:
        logging.error(f"Error getting cart abandonment: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cart abandonment data")

@api_router.get("/admin/analytics/customer-insights")
async def get_customer_insights(admin_user: User = Depends(get_admin_user)):
    """Cohorts and repeat customer metrics."""
    try:
        orders = await db.orders.find({"status": {"$ne": "cancelled"}}).to_list(20000)
        if not orders:
            return {
                "repeat_customer_rate": 0,
                "repeat_customers": 0,
                "total_customers": 0,
                "monthly_cohorts": {}
            }

        orders_by_user: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        cohorts: Dict[str, Dict[str, int]] = defaultdict(lambda: {"new_customers": 0, "orders": 0, "revenue": 0})

        for order in orders:
            user_id = order.get("user_id")
            if not user_id:
                continue
            orders_by_user[user_id].append(order)

        for user_orders in orders_by_user.values():
            user_orders.sort(key=lambda o: str(o.get("created_at", "")))
            first = user_orders[0]
            created = first.get("created_at")
            if isinstance(created, str):
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                created_dt = created
            cohort_key = created_dt.strftime("%Y-%m")
            cohorts[cohort_key]["new_customers"] += 1

            for order in user_orders:
                cohorts[cohort_key]["orders"] += 1
                cohorts[cohort_key]["revenue"] += float(order.get("total_amount", 0) or 0)

        total_customers = len(orders_by_user)
        repeat_customers = sum(1 for _, items in orders_by_user.items() if len(items) > 1)
        repeat_rate = round((repeat_customers / total_customers) * 100, 2) if total_customers > 0 else 0

        return {
            "repeat_customer_rate": repeat_rate,
            "repeat_customers": repeat_customers,
            "total_customers": total_customers,
            "monthly_cohorts": cohorts
        }
    except Exception as e:
        logging.error(f"Error getting customer insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to get customer insights")

@api_router.get("/admin/analytics/returns-overview")
async def get_returns_overview(admin_user: User = Depends(get_admin_user)):
    """Return rate by product/category and overall."""
    try:
        returns = await db.returns.find({}).to_list(20000)
        orders = await db.orders.find({"status": {"$ne": "cancelled"}}).to_list(20000)

        ordered_qty_by_product: Dict[str, int] = defaultdict(int)
        for order in orders:
            for item in order.get("products", []):
                ordered_qty_by_product[item.get("product_id")] += int(item.get("quantity", 0) or 0)

        returned_qty_by_product: Dict[str, int] = defaultdict(int)
        for req in returns:
            pid = req.get("product_id")
            returned_qty_by_product[pid] += int(req.get("quantity", 0) or 0)

        by_product = []
        by_category: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"ordered_qty": 0, "returned_qty": 0})
        for product_id, ordered_qty in ordered_qty_by_product.items():
            product = await db.products.find_one({"id": product_id})
            category = product.get("category", "Uncategorized") if product else "Uncategorized"
            returned_qty = returned_qty_by_product.get(product_id, 0)
            return_rate = round((returned_qty / ordered_qty) * 100, 2) if ordered_qty > 0 else 0
            by_product.append({
                "product_id": product_id,
                "name": product.get("name", "Unknown Product") if product else "Unknown Product",
                "category": category,
                "ordered_qty": ordered_qty,
                "returned_qty": returned_qty,
                "return_rate": return_rate
            })
            by_category[category]["ordered_qty"] += ordered_qty
            by_category[category]["returned_qty"] += returned_qty

        category_rows = []
        for category, stats in by_category.items():
            rate = round((stats["returned_qty"] / stats["ordered_qty"]) * 100, 2) if stats["ordered_qty"] else 0
            category_rows.append({
                "category": category,
                "ordered_qty": stats["ordered_qty"],
                "returned_qty": stats["returned_qty"],
                "return_rate": rate
            })

        total_ordered = sum(ordered_qty_by_product.values())
        total_returned = sum(returned_qty_by_product.values())
        overall_return_rate = round((total_returned / total_ordered) * 100, 2) if total_ordered > 0 else 0

        by_product.sort(key=lambda x: x["return_rate"], reverse=True)
        category_rows.sort(key=lambda x: x["return_rate"], reverse=True)
        return {
            "overall_return_rate": overall_return_rate,
            "by_product": by_product[:30],
            "by_category": category_rows
        }
    except Exception as e:
        logging.error(f"Error getting returns overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to get returns overview")

# ORDER ROUTES for cancelled order
@api_router.get("/orders", response_model=List[Order])
async def get_user_orders(current_user: User = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": current_user.id}).sort("created_at", -1).to_list(50)
    normalized_orders: List[Order] = []
    for order in orders:
        clean = normalize_mongo_for_json(order)
        if "_id" in clean and not clean.get("id"):
            clean["id"] = str(clean["_id"])
        clean.pop("_id", None)
        normalized_orders.append(Order(**clean))
    return normalized_orders

@api_router.get("/admin/orders")
async def get_all_orders(admin_user: User = Depends(get_admin_user)):
    orders = await db.orders.find({}).sort("created_at", -1).to_list(100)

    # Convert ObjectId values recursively and ensure id field exists
    normalized_orders = []
    for order in orders:
        order = normalize_mongo_for_json(order)
        if "_id" in order:
            order["id"] = str(order["_id"])
            del order["_id"]
        # Ensure every order has an id field
        if "id" not in order or not order.get("id"):
            order["id"] = str(uuid.uuid4())
        # Ensure status field exists
        if "status" not in order:
            order["status"] = "pending"
        normalized_orders.append(order)

    # Return raw order data without strict validation for admin purposes
    return normalized_orders

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    """Create a new order"""
    try:
        # Get user delivery address
        user_doc = await db.users.find_one({"id": current_user.id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if user has delivery address
        delivery_address_data = user_doc.get("delivery_address")
        if not delivery_address_data:
            raise HTTPException(status_code=400, detail="Please add a delivery address before placing an order")

        # Generate sequential order ID starting from 0001
        # Find the highest existing order_id number
        last_order = await db.orders.find_one(
            {"order_id": {"$exists": True, "$ne": None}},
            sort=[("order_id", -1)]
        )

        if last_order and last_order.get("order_id"):
            # Extract number from existing order_id (e.g., "0001" -> 1)
            try:
                last_number = int(last_order["order_id"])
                next_number = last_number + 1
            except (ValueError, TypeError):
                next_number = 1
        else:
            next_number = 1

        # Format as 4-digit zero-padded string
        order_id = f"{next_number:04d}"

        subtotal = float(order_data.total_amount)
        coupon_meta = await apply_coupon_if_valid(order_data.coupon_code, subtotal)
        final_total = round(subtotal - float(coupon_meta["discount_amount"]), 2)

        # Create order dict with user information
        order_dict = order_data.dict()
        # Ensure delivery_address is properly serialized
        delivery_address = DeliveryAddress(**delivery_address_data)
        order_dict["delivery_address"] = delivery_address.dict()
        order_dict["discount_amount"] = coupon_meta["discount_amount"]
        order_dict["coupon_code"] = coupon_meta["code"]
        order_dict["total_amount"] = max(0.0, final_total)
        order_dict["status_history"] = [build_status_event("pending", actor="system", note="Order created")]

        order_dict.update({
            "user_id": current_user.id,
            "user_email": current_user.email,
            "status": "pending",
            "order_id": order_id
        })

        # Create Order instance with custom id (sequential order_id)
        order = Order(**order_dict)
        # Override the id field with the sequential order_id
        order.id = order_id

        # Insert order into database
        await db.orders.insert_one(order.dict())

        # Reduce stock for each product in the order
        for order_item in order_data.products:
            # Try to find product by id field first
            product = await db.products.find_one({"id": order_item.product_id})

            # If not found and product_id looks like ObjectId, try by _id
            if not product:
                try:
                    if ObjectId.is_valid(order_item.product_id):
                        product = await db.products.find_one({"_id": ObjectId(order_item.product_id)})
                except Exception as e:
                    logging.warning(f"ObjectId conversion failed for product {order_item.product_id}: {e}")

            if not product:
                logging.error(f"Product {order_item.product_id} not found during stock reduction")
                raise HTTPException(status_code=500, detail=f"Product {order_item.product_id} not found")

            if order_item.variant_sku:
                variants = product.get("variants", [])
                idx = next((i for i, v in enumerate(variants) if v.get("sku") == order_item.variant_sku), -1)
                if idx == -1:
                    raise HTTPException(status_code=400, detail=f"Variant {order_item.variant_sku} not found")
                current_variant_stock = int(variants[idx].get("stock", 0))
                if current_variant_stock < order_item.quantity:
                    raise HTTPException(status_code=400, detail=f"Insufficient variant stock for {order_item.name}")
                variants[idx]["stock"] = current_variant_stock - order_item.quantity
                new_total_stock = sum(max(0, int(v.get("stock", 0))) for v in variants)
                await db.products.update_one(
                    {"id": order_item.product_id},
                    {"$set": {"variants": variants, "stock": new_total_stock}}
                )
            else:
                current_stock = product.get("stock", 0)
                if current_stock < order_item.quantity:
                    logging.error(f"Insufficient stock for product {order_item.product_id}: requested {order_item.quantity}, available {current_stock}")
                    raise HTTPException(status_code=400, detail=f"Insufficient stock for product {order_item.name}")

                # Reduce stock - try both id and _id for update
                new_stock = current_stock - order_item.quantity
                update_result = await db.products.update_one(
                    {"id": order_item.product_id},
                    {"$set": {"stock": new_stock}}
                )

                # If no document was updated and product_id looks like ObjectId, try by _id
                if update_result.modified_count == 0:
                    try:
                        if ObjectId.is_valid(order_item.product_id):
                            update_result = await db.products.update_one(
                                {"_id": ObjectId(order_item.product_id)},
                                {"$set": {"stock": new_stock}}
                            )
                    except Exception as e:
                        logging.warning(f"ObjectId conversion failed for stock update {order_item.product_id}: {e}")

                logging.info(f"Reduced stock for product {order_item.product_id} to {new_stock}")

        if coupon_meta.get("code"):
            await db.coupons.update_one({"code": coupon_meta["code"]}, {"$inc": {"used_count": 1}})

        # Return Order instance to ensure proper serialization
        return order

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Order creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")

@api_router.put("/admin/orders/{order_id}")
async def update_order_status(order_id: str, status: str = Query(...), admin_user: User = Depends(get_admin_user)):
    valid_statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    logging.info(f"Updating order status for order_id: {order_id}, status: {status}")

    # Try to find by id field or _id
    try:
        result = await db.orders.update_one(
            {"$or": [{"id": order_id}, {"_id": ObjectId(order_id)}]},
            {
                "$set": {"status": status},
                "$push": {"status_history": build_status_event(status, actor="admin")}
            }
        )
        logging.info(f"Update result: matched_count={result.matched_count}, modified_count={result.modified_count}")
    except Exception as e:
        logging.warning(f"ObjectId conversion failed for {order_id}: {e}")
        # If ObjectId fails, try just id
        result = await db.orders.update_one(
            {"id": order_id},
            {
                "$set": {"status": status},
                "$push": {"status_history": build_status_event(status, actor="admin")}
            }
        )
        logging.info(f"Fallback update result: matched_count={result.matched_count}, modified_count={result.modified_count}")

    if result.matched_count == 0:
        # Log all orders for debugging
        all_orders = await db.orders.find({}).to_list(10)
        logging.error(f"Order {order_id} not found. Available orders: {[order.get('id', order.get('_id')) for order in all_orders]}")
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated successfully"}

@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, current_user: User = Depends(get_current_user)):
    """
    Allow a user to cancel their own order if it is in 'pending' or 'confirmed' status.
    """
    try:
        # First try to find by UUID-based 'id'
        order = await db.orders.find_one({"user_id": current_user.id, "id": order_id})

        # If not found and order_id could be a Mongo ObjectId, try that
        if not order:
            try:
                oid = ObjectId(order_id)
                order = await db.orders.find_one({"user_id": current_user.id, "_id": oid})
            except Exception:
                oid = None  # Not a valid ObjectId; ignore and continue

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        status = (order.get("status") or "pending").lower()
        if status not in ["pending", "confirmed"]:
            raise HTTPException(status_code=400, detail="Order cannot be cancelled in its current status")

        # Try update by UUID 'id' first
        result = await db.orders.update_one(
            {"user_id": current_user.id, "id": order_id},
            {
                "$set": {"status": "cancelled"},
                "$push": {"status_history": build_status_event("cancelled", actor="user")}
            }
        )

        # If no match, try update by ObjectId if valid
        if result.matched_count == 0:
            try:
                oid = ObjectId(order_id)
                result = await db.orders.update_one(
                    {"user_id": current_user.id, "_id": oid},
                    {
                        "$set": {"status": "cancelled"},
                        "$push": {"status_history": build_status_event("cancelled", actor="user")}
                    }
                )
            except Exception:
                pass

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")

        return {"message": "Order cancelled successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Cancel order error: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel order")

@api_router.post("/orders/buy-now")
async def create_buy_now_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    """Create a buy now order (direct purchase without cart)"""
    try:
        # Get user delivery address
        user_doc = await db.users.find_one({"id": current_user.id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if user has delivery address
        delivery_address_data = user_doc.get("delivery_address")
        if not delivery_address_data:
            raise HTTPException(status_code=400, detail="Please add a delivery address before placing an order")

        # Validate stock for each product
        for order_item in order_data.products:
            product = await db.products.find_one({"id": order_item.product_id})
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {order_item.product_id} not found")

            current_stock = product.get("stock", 0)
            if current_stock < order_item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product {order_item.name}")

        # Generate sequential order ID starting from 0001
        last_order = await db.orders.find_one(
            {"order_id": {"$exists": True, "$ne": None}},
            sort=[("order_id", -1)]
        )

        if last_order and last_order.get("order_id"):
            try:
                last_number = int(last_order["order_id"])
                next_number = last_number + 1
            except (ValueError, TypeError):
                next_number = 1
        else:
            next_number = 1

        order_id = f"{next_number:04d}"

        subtotal = float(order_data.total_amount)
        coupon_meta = await apply_coupon_if_valid(order_data.coupon_code, subtotal)
        final_total = round(subtotal - float(coupon_meta["discount_amount"]), 2)

        # Create order dict
        order_dict = order_data.dict()
        delivery_address = DeliveryAddress(**delivery_address_data)
        order_dict["delivery_address"] = delivery_address.dict()
        order_dict["discount_amount"] = coupon_meta["discount_amount"]
        order_dict["coupon_code"] = coupon_meta["code"]
        order_dict["total_amount"] = max(0.0, final_total)
        order_dict["status_history"] = [build_status_event("pending", actor="system", note="Buy now order created")]

        order_dict.update({
            "user_id": current_user.id,
            "user_email": current_user.email,
            "status": "pending",
            "order_id": order_id
        })

        order = Order(**order_dict)
        order.id = order_id

        # Insert order
        await db.orders.insert_one(order.dict())

        # Reduce stock for each product
        for order_item in order_data.products:
            product = await db.products.find_one({"id": order_item.product_id})
            if order_item.variant_sku:
                variants = product.get("variants", [])
                idx = next((i for i, v in enumerate(variants) if v.get("sku") == order_item.variant_sku), -1)
                if idx == -1:
                    raise HTTPException(status_code=400, detail=f"Variant {order_item.variant_sku} not found")
                current_variant_stock = int(variants[idx].get("stock", 0))
                if current_variant_stock < order_item.quantity:
                    raise HTTPException(status_code=400, detail=f"Insufficient variant stock for {order_item.name}")
                variants[idx]["stock"] = current_variant_stock - order_item.quantity
                new_total_stock = sum(max(0, int(v.get("stock", 0))) for v in variants)
                await db.products.update_one(
                    {"id": order_item.product_id},
                    {"$set": {"variants": variants, "stock": new_total_stock}}
                )
            else:
                current_stock = product.get("stock", 0)
                new_stock = current_stock - order_item.quantity
                await db.products.update_one(
                    {"id": order_item.product_id},
                    {"$set": {"stock": new_stock}}
                )

        if coupon_meta.get("code"):
            await db.coupons.update_one({"code": coupon_meta["code"]}, {"$inc": {"used_count": 1}})

        return order

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Buy now order creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")

# SUPPORT ROUTES
@api_router.post("/support/tickets", response_model=SupportTicket)
async def create_support_ticket(
    ticket_data: SupportTicketCreate,
    current_user: Optional[User] = Depends(get_current_user)
):
    ticket = SupportTicket(**ticket_data.dict())
    if current_user:
        ticket.user_id = current_user.id

    # Add initial message
    ticket.messages = [{
        "sender": "user",
        "message": ticket_data.description,
        "timestamp": ticket.created_at.isoformat()
    }]

    await db.support_tickets.insert_one(ticket.dict())
    return ticket

@api_router.get("/admin/support/tickets", response_model=List[SupportTicket])
async def get_support_tickets(admin_user: User = Depends(get_admin_user)):
    tickets = await db.support_tickets.find({}).to_list(100)
    return [SupportTicket(**ticket) for ticket in tickets]

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    admin_reply: Optional[str] = None

@api_router.put("/admin/support/tickets/{ticket_id}")
async def update_support_ticket(ticket_id: str, update_data: SupportTicketUpdate, admin_user: User = Depends(get_admin_user)):
    db_update = {}

    if update_data.status:
        valid_statuses = ["open", "in_progress", "closed"]
        if update_data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        db_update["$set"] = db_update.get("$set", {})
        db_update["$set"]["status"] = update_data.status

    if update_data.admin_reply:
        # Append admin reply to messages
        admin_message = {
            "sender": "admin",
            "message": update_data.admin_reply,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        db_update["$push"] = {"messages": admin_message}

    if not db_update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = await db.support_tickets.update_one({"id": ticket_id}, db_update)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket updated successfully"}

class UserReplyRequest(BaseModel):
    user_reply: str

@api_router.put("/support/tickets/{ticket_id}/reply")
async def user_reply_to_ticket(ticket_id: str, reply_data: UserReplyRequest, current_user: User = Depends(get_current_user)):
    # Check if ticket belongs to user and is not closed
    ticket = await db.support_tickets.find_one({"id": ticket_id, "user_id": current_user.id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or access denied")

    if ticket.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to closed ticket")

    # Append user reply to messages
    user_message = {
        "sender": "user",
        "message": reply_data.user_reply,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    result = await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": user_message}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return {"message": "Reply sent successfully"}

@api_router.delete("/admin/support/tickets/{ticket_id}")
async def delete_support_ticket(ticket_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.support_tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket deleted successfully"}

# USER SUPPORT TICKET ROUTES
@api_router.get("/support/tickets/my", response_model=List[SupportTicket])
async def get_my_support_tickets(current_user: User = Depends(get_current_user)):
    tickets = await db.support_tickets.find({"user_id": current_user.id}).to_list(100)
    return [SupportTicket(**ticket) for ticket in tickets]

@api_router.delete("/support/tickets/{ticket_id}")
async def delete_my_support_ticket(ticket_id: str, current_user: User = Depends(get_current_user)):
    # Find the ticket first to ensure it belongs to the user
    ticket = await db.support_tickets.find_one({"id": ticket_id, "user_id": current_user.id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or access denied")

    result = await db.support_tickets.delete_one({"id": ticket_id})
    return {"message": "Ticket deleted successfully"}

# FAQ ROUTES
@api_router.get("/faqs", response_model=List[FAQ])
async def get_faqs(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    
    faqs = await db.faqs.find(query).to_list(50)
    return [FAQ(**faq) for faq in faqs]

@api_router.post("/admin/faqs", response_model=FAQ)
async def create_faq(faq_data: FAQCreate, admin_user: User = Depends(get_admin_user)):
    faq = FAQ(**faq_data.dict())
    await db.faqs.insert_one(faq.dict())
    return faq

# ADMIN DASHBOARD DATA
@api_router.get("/admin/dashboard")
async def get_dashboard_data(admin_user: User = Depends(get_admin_user)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    total_tickets = await db.support_tickets.count_documents({"status": "open"})

    # Recent orders
    recent_orders = await db.orders.find({}).sort("created_at", -1).limit(5).to_list(5)

    # Process recent orders
    recent_orders_list = []
    for order in recent_orders:
        order_data = {k: v for k, v in order.items() if k in Order.__fields__}
        # Ensure required fields are present
        if 'products' not in order_data or not order_data['products']:
            order_data['products'] = order_data.get('items', [])
        if 'total_amount' not in order_data or not order_data['total_amount']:
            order_data['total_amount'] = order_data.get('total_price', 0)
        try:
            recent_orders_list.append(Order(**order_data))
        except Exception as e:
            logging.warning(f"Failed to create Order object: {e}")
            continue

    return {
        "stats": {
            "total_products": total_products,
            "total_orders": total_orders,
            "total_users": total_users,
            "open_tickets": total_tickets
        },
        "recent_orders": recent_orders_list
    }

# ADMIN DASHBOARD COUNTERS - Real-time data for Quick Actions
@api_router.get("/admin/dashboard/counters")
async def get_dashboard_counters(admin_user: User = Depends(get_admin_user)):
    """Get real-time counters for admin dashboard Quick Actions"""
    # Total products
    total_products = await db.products.count_documents({})

    # Total pending/open orders (orders that are not completed)
    total_pending_orders = await db.orders.count_documents({
        "$or": [
            {"status": {"$ne": "delivered"}},
            {"status": {"$in": ["pending", "confirmed", "shipped"]}}
        ]
    })

    # Total registered users
    total_users = await db.users.count_documents({"role": "user"})

    # Total unresolved support tickets (open or in_progress)
    total_unresolved_tickets = await db.support_tickets.count_documents({
        "status": {"$in": ["open", "in_progress"]}
    })

    return {
        "total_products": total_products,
        "total_pending_orders": total_pending_orders,
        "total_users": total_users,
        "total_unresolved_tickets": total_unresolved_tickets
    }





# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create uploads directory if it doesn't exist
upload_dir = Path("uploads")
upload_dir.mkdir(exist_ok=True)

# Serve static files for uploaded images
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/admin/upload-images")
async def upload_images(files: List[UploadFile] = File(...), admin_user: User = Depends(get_admin_user)):
    """
    Upload images. If Cloudinary credentials are configured, upload to Cloudinary.
    Otherwise save to local uploads/ directory and return local URLs.
    """
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    uploaded_urls = []

    for file in files:
        file_ext = file.filename.split(".")[-1]
        if file_ext.lower() not in ["jpg", "jpeg", "png", "gif", "webp"]:
            raise HTTPException(status_code=400, detail="Invalid image format")

        # If Cloudinary is configured, upload there
        if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
            try:
                content = await file.read()
                file_stream = io.BytesIO(content)
                # Use use_filename=True + unique_filename=True to keep filenames meaningful but unique
                res = cloudinary.uploader.upload(
                    file_stream,
                    folder=CLOUDINARY_FOLDER,
                    resource_type="image",
                    use_filename=True,
                    unique_filename=True,
                )
                # prefer secure_url if available
                public_url = res.get("secure_url") or res.get("url")
                uploaded_urls.append(public_url)
            except Exception as e:
                logging.error(f"Cloudinary upload failed for {file.filename}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to upload {file.filename}")
            finally:
                # ensure UploadFile buffer closed
                try:
                    await file.close()
                except Exception:
                    pass

        else:
            # Fallback: save to local uploads directory
            unique_filename = f"{uuid.uuid4()}.{file_ext}"
            file_path = upload_dir / unique_filename
            try:
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                # construct public URL using your server root; in production set proper base URL
                # When deploying on Render/Vercel you should use your deployed domain here.
                public_url = f"{os.environ.get('BACKEND_BASE_URL', 'http://localhost:8000')}/uploads/{unique_filename}"
                uploaded_urls.append(public_url)
            except Exception as e:
                logging.error(f"Local file save failed for {file.filename}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to save {file.filename}")
            finally:
                try:
                    await file.close()
                except Exception:
                    pass

    return {"urls": uploaded_urls}




@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
