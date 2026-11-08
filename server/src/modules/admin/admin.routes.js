import {Router} from 'express';import {z} from 'zod';import {User,Donation,DonationRequest,Assignment,Payment,Organization,AuditLog} from '../../models/index.js';import {requireAuth,safeUser} from '../../middleware/authenticate.js';
import {roles} from '../../middleware/authorize.js';import {run,fail,validate,audit} from '../../utils/http.js';
const router=Router();router.use(requireAuth,roles('admin'));
router.get('/users',run(async(req,res)=>{const users=await User.find().sort({createdAt:-1}).limit(200);res.json({items:users.map(safeUser)});}));
router.patch('/users/:id/status',run(async(req,res)=>{const{status}=validate(z.object({status:z.enum(['pending','verified','rejected','suspended'])}),req.body);const u=await User.findById(req.params.id);if(!u)throw fail(404,'User not found');if(u.role==='admin'||u.id===req.user.id)throw fail(403,'Admin account cannot be modified here');u.status=status;await u.save();await audit(req.user.id,'User',u.id,status==='suspended'?'suspension':'verification',{status});res.json({user:safeUser(u)});}));
router.get('/summary',run(async(req,res)=>{const [donors,ngos,volunteers,active,requests,completed,paid]=await Promise.all([User.countDocuments({role:'donor'}),User.countDocuments({role:'ngo'}),User.countDocuments({role:'volunteer'}),Donation.countDocuments({status:{$in:['available','requested']},pickupDeadline:{$gt:new Date()}}),DonationRequest.countDocuments({status:'pending'}),Assignment.countDocuments({status:'delivered'}),Payment.aggregate([{$match:{status:'paid'}},{$group:{_id:null,total:{$sum:'$amountPaise'},count:{$sum:1}}}])]);res.json({donors,ngos,volunteers,active,requests,completed,sponsorshipPaise:paid[0]?.total||0,payments:paid[0]?.count||0});}));
router.get('/payments',run(async(req,res)=>res.json({items:await Payment.find().select('-__v').sort({createdAt:-1}).limit(100)})));
router.get('/audit',run(async(req,res)=>{
  const items=await AuditLog.find().sort({createdAt:-1}).limit(100).populate('actor','name').populate({
    path:'entityId',
    select:'name title donation request assignment sponsorName',
    populate:[
      {path:'donation',select:'title',strictPopulate:false},
      {path:'request',select:'donation',populate:{path:'donation',select:'title'},strictPopulate:false},
      {path:'assignment',select:'request',populate:{path:'request',select:'donation',populate:{path:'donation',select:'title'}},strictPopulate:false}
    ]
  }).lean();
  res.json({items:items.map(item=>{
    const entity=item.entityId;
    // Older suspension entries were recorded under the verification action.
    const action=item.entityType==='User'&&item.action==='verification'&&item.detail?.status==='suspended'?'suspension':item.action;
    return {...item,action,entityId:entity?._id,entityLabel:entity?.name||entity?.title||entity?.donation?.title||entity?.request?.donation?.title||entity?.assignment?.request?.donation?.title||entity?.sponsorName||'Deleted or unavailable record'};
  })});
}));
export default router;
