import mongoose from 'mongoose';
import {Router} from 'express';import {z} from 'zod';import { Donation } from './donation.model.js';
import { DonationRequest } from '../requests/request.model.js';import {run,fail,validate,id,notify,audit} from '../../utils/http.js';import {requireAuth} from '../../middleware/authenticate.js';
import {roles,verified} from '../../middleware/authorize.js';
const router=Router();router.use(requireAuth);
const createSchema=z.object({title:z.string().min(3).max(140),description:z.string().max(2000).optional(),category:z.enum(['prepared','produce','bakery','packaged','other']),quantity:z.coerce.number().int().positive().max(100000),unit:z.enum(['meals','kg','packs','pieces']),preparedAt:z.string().datetime({offset:true}),pickupDeadline:z.string().datetime({offset:true}),storageInfo:z.string().min(3).max(500),handlingInstructions:z.string().max(500).optional(),address:z.string().min(5).max(300)});
router.get('/',run(async(req,res)=>{const page=Math.max(1,Number.parseInt(req.query.page)||1),limit=Math.min(30,Math.max(1,Number.parseInt(req.query.limit)||12));const filter={};if(req.query.mine==='true'){if(req.user.role!=='donor')throw fail(403,'Donor only');filter.donor=req.user.id;}else{filter.status={$in:['available','requested']};filter.pickupDeadline={$gt:new Date()};filter.quantityAvailable={$gt:0};}if(req.query.category&&['prepared','produce','bakery','packaged','other'].includes(req.query.category))filter.category=req.query.category;const [items,total]=await Promise.all([Donation.find(filter).select(req.query.mine==='true'?'':'-location -address -handlingInstructions').sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('donor','name').lean(),Donation.countDocuments(filter)]);res.json({items,total,page,pages:Math.ceil(total/limit)});}));
router.post('/',roles('donor'),verified,run(async(req,res)=>{const d=validate(createSchema,req.body);if(new Date(d.preparedAt)>new Date())throw fail(400,'Prepared time cannot be in the future');if(new Date(d.pickupDeadline)<=new Date()||new Date(d.preparedAt)>new Date(d.pickupDeadline))throw fail(400,'Invalid food preparation or pickup time');const donation=await Donation.create({donor:req.user.id,title:d.title,description:d.description,category:d.category,quantityTotal:d.quantity,quantityAvailable:d.quantity,unit:d.unit,preparedAt:new Date(d.preparedAt),pickupDeadline:new Date(d.pickupDeadline),storageInfo:d.storageInfo,handlingInstructions:d.handlingInstructions,address:d.address});await audit(req.user.id,'Donation',donation.id,'created');res.status(201).json({donation});}));
router.get('/nearby',run(async(req,res)=>{const lng=Number(req.query.lng),lat=Number(req.query.lat);if(req.query.lng===undefined||req.query.lat===undefined||req.query.lng===''||req.query.lat===''||!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>90)throw fail(400,'Valid coordinates required');const items=await Donation.find({status:{$in:['available','requested']},pickupDeadline:{$gt:new Date()},quantityAvailable:{$gt:0},location:{$near:{$geometry:{type:'Point',coordinates:[lng,lat]},$maxDistance:Math.min(100000,Math.max(1000,Number(req.query.radius)||20000))}}}).select('-address -location -handlingInstructions').limit(30);res.json({items});}));
router.get('/:id',run(async(req,res)=>{if(!id(req.params.id))throw fail(400,'Bad ID');const d=await Donation.findById(req.params.id).populate('donor','name');if(!d)throw fail(404,'Not found');const authorized=req.user.role==='admin'||String(d.donor.id||d.donor)===req.user.id;const pub=d.toObject();if(!authorized){delete pub.address;delete pub.location;delete pub.handlingInstructions;}res.json({donation:pub});}));
router.patch('/:id',roles('donor'),verified,run(async(req,res)=>{
  const data=validate(z.object({description:z.string().max(2000).optional(),handlingInstructions:z.string().max(500).optional(),status:z.enum(['cancelled']).optional()}),req.body);
  const {donation,cancelled}=await mongoose.connection.transaction(async session=>{
    const donation=await Donation.findOne({_id:req.params.id,donor:req.user.id}).session(session);
    if(!donation)throw fail(404,'Own listing not found');
    if(donation.status==='cancelled')throw fail(409,'Listing is already cancelled');
    let cancelled=[];
    if(data.status==='cancelled'){
      if(await DonationRequest.exists({donation:donation.id,status:{$in:['approved','partially_approved','assigned','delivered']}}).session(session))throw fail(409,'Cannot cancel a listing with reserved donations');
      cancelled=await DonationRequest.find({donation:donation.id,status:'pending'}).session(session);
      await DonationRequest.updateMany({donation:donation.id,status:'pending'},{$set:{status:'cancelled'}},{session});
    }
    Object.assign(donation,data);await donation.save({session});
    return {donation,cancelled};
  });
  for(const request of cancelled)await notify(request.ngo,'Listing cancelled',`${donation.title} was cancelled by the donor. Your pending request has been cancelled.`);
  await audit(req.user.id,'Donation',donation.id,data.status==='cancelled'?'cancelled':'updated',data);
  res.json({donation});
}));
router.post('/:id/requests',roles('ngo'),verified,run(async(req,res)=>{
  const data=validate(z.object({requestedQuantity:z.coerce.number().int().positive(),collectionPlan:z.string().min(8).max(1000),beneficiaryEstimate:z.coerce.number().int().min(0).max(100000).default(0)}),req.body);
  const {donation,request}=await mongoose.connection.transaction(async session=>{
    // Touch the listing in the same transaction, serializing request creation with cancellation.
    const donation=await Donation.findOneAndUpdate({_id:req.params.id,status:{$in:['available','requested']},pickupDeadline:{$gt:new Date()},quantityAvailable:{$gte:data.requestedQuantity}},{$set:{status:'requested'}},{session,new:true});
    if(!donation)throw fail(409,'Food not available in requested quantity');
    if(await DonationRequest.exists({donation:donation.id,ngo:req.user.id,status:'pending'}).session(session))throw fail(409,'You already have a pending request');
    const [request]=await DonationRequest.create([{donation:donation.id,ngo:req.user.id,...data}],{session});
    return {donation,request};
  });
  await notify(donation.donor,'New food request',`${req.user.name} requested ${data.requestedQuantity} ${donation.unit} of ${donation.title}`);
  await audit(req.user.id,'DonationRequest',request.id,'created');
  res.status(201).json({request});
}));
router.get('/:id/requests',run(async(req,res)=>{const d=await Donation.findById(req.params.id);if(!d)throw fail(404,'Donation not found');if(req.user.role!=='admin'&&String(d.donor)!==req.user.id)throw fail(403,'Access denied');res.json({items:await DonationRequest.find({donation:d.id}).populate('ngo','name email').sort({createdAt:-1})});}));
export default router;
