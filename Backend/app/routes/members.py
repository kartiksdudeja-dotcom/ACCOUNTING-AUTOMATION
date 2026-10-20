from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.member import Member
from sqlalchemy import func
from app.models.monthly_charge import MonthlyCharge
from app.models.expense import Expense
from app.models.sinking_fund import SinkingFund
from app.models.owner_extra_payment import OwnerExtraPayment
from app.models.other_collection import OtherCollection
router = APIRouter()
@router.get("/members")
def get_members(db: Session = Depends(get_db)):
    return db.query(Member).all()
@router.get("/members/search/{unit_no}")
def search_member(unit_no: str, db: Session = Depends(get_db)):
    member = db.query(Member).filter(
        Member.unit_no == unit_no
    ).first()

    if not member:
        return {"message": "Member Not Found"}

    return member

@router.get("/members/{member_id}")
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(
        Member.id == member_id
    ).first()

    if not member:
        return {"message": "Member Not Found"}

    return member

@router.post("/members")
def add_member(data: dict, db: Session = Depends(get_db)):
    existing = db.query(Member).filter(
        Member.unit_no == data["unit_no"]
    ).first()

    if existing:
        return {
            "message": "Unit Number Already Exists"
        }
    member = Member(
        unit_no=data["unit_no"],
        unit_type=data["unit_type"],
        new_owner=data["new_owner"],
        old_owner=data["old_owner"],
        carpet_area=data["carpet_area"],
        mobile=data["mobile"],
        email=data["email"],
        status=data["status"]
    )

    db.add(member)
    db.commit()

    return {"message": "Member Added"}

@router.put("/members/{member_id}")
def update_member(member_id: int, data: dict, db: Session = Depends(get_db)):
    member = db.query(Member).filter(
        Member.id == member_id
    ).first()

    if not member:
        return {"message": "Member Not Found"}
    member.unit_no = data.get("unit_no", member.unit_no)

    member.unit_type = data.get("unit_type", member.unit_type)

    member.new_owner = data.get("new_owner", member.new_owner)

    member.old_owner = data.get("old_owner", member.old_owner)

    member.carpet_area = data.get("carpet_area", member.carpet_area)

    member.mobile = data.get("mobile", member.mobile)

    member.email = data.get("email", member.email)

    member.status = data.get("status", member.status)  

    db.commit()

    return {"message": "Member Updated"}

@router.delete("/members/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(
        Member.id == member_id
    ).first()

    if not member:
        return {"message": "Member Not Found"}

    db.delete(member)
    db.commit()

    return {"message": "Member Deleted"}
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_members = db.query(Member).filter(
        Member.unit_no != "0"
    ).count()

    offices = db.query(Member).filter(
        func.lower(Member.unit_type) == "office",
        Member.unit_no != "0"
    ).count()

    shops = db.query(Member).filter(
        func.lower(Member.unit_type).in_(["shop", "shops"])
    ).count()

    return {
        "total_members": total_members,
        "shops": shops,
        "offices": offices
    }


@router.get("/accounts/dashboard")
def accounts_dashboard(db: Session = Depends(get_db)):
    total_collection = db.query(
        func.sum(MonthlyCharge.paid_amount)
    ).scalar() or 0

    total_dues = db.query(
        func.sum(MonthlyCharge.due_amount)
    ).scalar() or 0

    total_expenses = db.query(
        func.sum(Expense.amount)
    ).scalar() or 0

    total_sinking_paid = db.query(
        func.sum(SinkingFund.paid_amount)
    ).scalar() or 0

    total_sinking_due = db.query(
        func.sum(SinkingFund.due_amount)
    ).scalar() or 0

    total_owner_extra = db.query(
        func.sum(OwnerExtraPayment.amount)
    ).scalar() or 0

    total_other_collections = db.query(
        func.sum(OtherCollection.amount)
    ).scalar() or 0

    net_balance = total_collection - total_expenses

    return {
        "total_collection": total_collection,
        "total_dues": total_dues,
        "total_expenses": total_expenses,
        "total_sinking_paid": total_sinking_paid,
        "total_sinking_due": total_sinking_due,
        "total_owner_extra": total_owner_extra,
        "total_other_collections": total_other_collections,
        "net_balance": net_balance
    }


@router.get("/accounts/expenses")
def get_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).order_by(Expense.id).all()


@router.get('/accounts/owner_extras')
def get_owner_extras(db: Session = Depends(get_db)):
    return db.query(OwnerExtraPayment).order_by(OwnerExtraPayment.id).all()


@router.post('/accounts/owner_extras')
def add_owner_extra(data: dict, db: Session = Depends(get_db)):
    extra = OwnerExtraPayment(unit_no=data.get('unit_no'), date=data.get('date'), amount=data.get('amount'), remarks=data.get('remarks'))
    db.add(extra)
    db.commit()
    return {'message': 'Owner Extra Recorded'}


@router.get('/accounts/other_collections')
def get_other_collections(db: Session = Depends(get_db)):
    return db.query(OtherCollection).order_by(OtherCollection.id).all()


@router.post('/accounts/other_collections')
def add_other_collection(data: dict, db: Session = Depends(get_db)):
    oc = OtherCollection(date=data.get('date'), amount=data.get('amount'), remarks=data.get('remarks'))
    db.add(oc)
    db.commit()
    return {'message': 'Other Collection Recorded'}


@router.get("/accounts/charges")
def get_charges(db: Session = Depends(get_db)):
    return db.query(MonthlyCharge).order_by(MonthlyCharge.id).all()


@router.get("/accounts/sinking")
def get_sinking(db: Session = Depends(get_db)):
    return db.query(SinkingFund).order_by(SinkingFund.id).all()